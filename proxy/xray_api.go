package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	"h-ui/model/bo"
)

const ManagedXrayEmailPrefix = "h-ui-account-"

type XrayAPI struct {
	binaryPath string
	address    string
	inboundTag string
	port       int
}

type XrayClient struct {
	Email string
	UUID  string
	Flow  string
}

type XrayStat struct {
	Name  string `json:"name"`
	Value int64  `json:"value"`
}

type XrayInboundUser struct {
	UUID string
	Flow string
}

type xrayInboundUsersResponse struct {
	Users []struct {
		Email   string `json:"email"`
		Account struct {
			ID   string `json:"id"`
			Flow string `json:"flow"`
		} `json:"account"`
	} `json:"users"`
}

type xrayStatsResponse struct {
	Stat []XrayStat `json:"stat"`
}

type xrayOnlineUsersResponse struct {
	Users []struct {
		Email string `json:"email"`
		IPs   []struct {
			IP string `json:"ip"`
		} `json:"ips"`
	} `json:"users"`
}

func NewXrayAPI(config bo.VlessConfig) *XrayAPI {
	binaryPath := strings.TrimSpace(config.XrayBinaryPath)
	if binaryPath == "" {
		binaryPath = "xray"
	}
	return &XrayAPI{
		binaryPath: binaryPath,
		address:    strings.TrimSpace(config.XrayAPIAddress),
		inboundTag: strings.TrimSpace(config.XrayInboundTag),
		port:       config.Port,
	}
}

// ConfigureXrayAPI enables Xray's local-only HandlerService and StatsService,
// tags the selected VLESS inbound and restarts the configured systemd unit
// only when the config file actually needs a change.
func ConfigureXrayAPI(config bo.VlessConfig) error {
	apiHost, apiPortText, err := net.SplitHostPort(strings.TrimSpace(config.XrayAPIAddress))
	if err != nil {
		return fmt.Errorf("invalid Xray API address: %w", err)
	}
	if apiHost != "localhost" {
		ip := net.ParseIP(apiHost)
		if ip == nil || !ip.IsLoopback() {
			return errors.New("Xray API must listen on a loopback address")
		}
	}
	apiPort, err := strconv.Atoi(apiPortText)
	if err != nil || apiPort < 1 || apiPort > 65535 || apiPort == config.Port {
		return errors.New("invalid Xray API port")
	}
	if strings.TrimSpace(config.XrayConfigPath) == "" || strings.TrimSpace(config.XrayServiceName) == "" ||
		strings.TrimSpace(config.XrayBinaryPath) == "" || strings.TrimSpace(config.XrayInboundTag) == "" {
		return errors.New("Xray config path, binary, service, and inbound tag are required")
	}

	configPath := filepath.Clean(config.XrayConfigPath)
	original, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("read Xray config: %w", err)
	}
	fileInfo, err := os.Stat(configPath)
	if err != nil {
		return fmt.Errorf("stat Xray config: %w", err)
	}

	var root map[string]interface{}
	decoder := json.NewDecoder(bytes.NewReader(original))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		return fmt.Errorf("parse Xray config: %w", err)
	}
	changed, err := ensureXrayManagementConfig(root, config, apiPort)
	if err != nil {
		return err
	}
	if !changed {
		if err := waitForXrayAPI(config, 3*time.Second); err == nil {
			return nil
		}
		if output, restartErr := exec.Command("systemctl", "restart", config.XrayServiceName).CombinedOutput(); restartErr != nil {
			return fmt.Errorf("restart Xray service: %w: %s", restartErr, strings.TrimSpace(string(output)))
		}
		return waitForXrayAPI(config, 20*time.Second)
	}

	if err := writeXrayConfig(config, configPath, original, fileInfo, root, true); err != nil {
		return err
	}
	return nil
}

func ensureXrayManagementConfig(root map[string]interface{}, config bo.VlessConfig, apiPort int) (bool, error) {
	inbounds, ok := root["inbounds"].([]interface{})
	if !ok {
		return false, errors.New("Xray config has no inbound list")
	}

	var target map[string]interface{}
	var candidates []map[string]interface{}
	for _, raw := range inbounds {
		inbound, ok := raw.(map[string]interface{})
		if !ok || inbound["protocol"] != "vless" {
			continue
		}
		candidates = append(candidates, inbound)
		if inbound["tag"] == config.XrayInboundTag {
			target = inbound
		}
	}
	if target == nil {
		for _, inbound := range candidates {
			if portMatches(inbound["port"], config.Port) {
				if target != nil {
					return false, errors.New("multiple VLESS inbounds use the configured port; set an explicit inbound tag")
				}
				target = inbound
			}
		}
	}
	if target == nil && len(candidates) == 1 {
		target = candidates[0]
	}
	if target == nil {
		return false, errors.New("cannot find a VLESS inbound matching the configured port and tag")
	}

	changed := false
	if target["tag"] != config.XrayInboundTag {
		target["tag"] = config.XrayInboundTag
		changed = true
	}
	for _, raw := range inbounds {
		inbound, ok := raw.(map[string]interface{})
		if ok && inbound["tag"] == "api" && (inbound["protocol"] != "dokodemo-door" || !portMatches(inbound["port"], apiPort)) {
			return false, errors.New("Xray inbound tag 'api' is already used")
		}
	}

	apiConfig, _ := root["api"].(map[string]interface{})
	if apiConfig == nil {
		apiConfig = map[string]interface{}{}
		root["api"] = apiConfig
		changed = true
	}
	if apiConfig["tag"] != "api" {
		apiConfig["tag"] = "api"
		changed = true
	}
	services := stringSlice(apiConfig["services"])
	serviceSet := map[string]bool{}
	for _, item := range services {
		serviceSet[item] = true
	}
	for _, item := range []string{"HandlerService", "StatsService"} {
		if !serviceSet[item] {
			services = append(services, item)
			serviceSet[item] = true
			changed = true
		}
	}
	apiConfig["services"] = services

	apiInbound := map[string]interface{}{
		"tag":      "api",
		"listen":   "127.0.0.1",
		"port":     apiPort,
		"protocol": "dokodemo-door",
		"settings": map[string]interface{}{"address": "127.0.0.1"},
	}
	apiIndex := -1
	for i, raw := range inbounds {
		inbound, ok := raw.(map[string]interface{})
		if ok && inbound["tag"] == "api" {
			apiIndex = i
			break
		}
	}
	if apiIndex < 0 {
		inbounds = append(inbounds, apiInbound)
		changed = true
	} else {
		before, _ := json.Marshal(inbounds[apiIndex])
		after, _ := json.Marshal(apiInbound)
		if !bytes.Equal(before, after) {
			inbounds[apiIndex] = apiInbound
			changed = true
		}
	}
	root["inbounds"] = inbounds

	stats, _ := root["stats"].(map[string]interface{})
	if stats == nil {
		root["stats"] = map[string]interface{}{}
		changed = true
	}
	policy, _ := root["policy"].(map[string]interface{})
	if policy == nil {
		policy = map[string]interface{}{}
		root["policy"] = policy
		changed = true
	}
	levels, _ := policy["levels"].(map[string]interface{})
	if levels == nil {
		levels = map[string]interface{}{}
		policy["levels"] = levels
		changed = true
	}
	level, _ := levels["0"].(map[string]interface{})
	if level == nil {
		level = map[string]interface{}{}
		levels["0"] = level
		changed = true
	}
	for _, key := range []string{"statsUserUplink", "statsUserDownlink", "statsUserOnline"} {
		if level[key] != true {
			level[key] = true
			changed = true
		}
	}

	routing, _ := root["routing"].(map[string]interface{})
	if routing == nil {
		routing = map[string]interface{}{}
		root["routing"] = routing
		changed = true
	}
	rules, _ := routing["rules"].([]interface{})
	ruleExists := false
	for _, raw := range rules {
		rule, ok := raw.(map[string]interface{})
		if !ok || rule["outboundTag"] != "api" {
			continue
		}
		if containsString(stringSlice(rule["inboundTag"]), "api") {
			ruleExists = true
			break
		}
	}
	if !ruleExists {
		rules = append([]interface{}{map[string]interface{}{
			"type":        "field",
			"inboundTag":  []interface{}{"api"},
			"outboundTag": "api",
		}}, rules...)
		routing["rules"] = rules
		changed = true
	}
	return changed, nil
}

func portMatches(value interface{}, port int) bool {
	if value == nil {
		return false
	}
	switch v := value.(type) {
	case json.Number:
		return v.String() == strconv.Itoa(port)
	case int:
		return v == port
	case int64:
		return v == int64(port)
	case float64:
		return int(v) == port
	case string:
		return v == strconv.Itoa(port)
	default:
		return false
	}
}

func stringSlice(value interface{}) []string {
	if items, ok := value.([]string); ok {
		return append([]string(nil), items...)
	}
	items, _ := value.([]interface{})
	result := make([]string, 0, len(items))
	for _, item := range items {
		if s, ok := item.(string); ok {
			result = append(result, s)
		}
	}
	return result
}

func containsString(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

func copyFileWithMode(source, destination string, mode os.FileMode, info os.FileInfo) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	return writeFileWithMetadata(destination, data, mode, info)
}

func restoreFile(path string, data []byte, info os.FileInfo) error {
	return writeFileWithMetadata(path, data, info.Mode().Perm(), info)
}

func writeFileWithMetadata(path string, data []byte, mode os.FileMode, info os.FileInfo) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".xray-restore-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Chmod(mode); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	if err = os.Rename(tmp.Name(), path); err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		if owner, ok := fileOwner(info); ok {
			_ = os.Chown(path, owner.uid, owner.gid)
		}
	}
	return nil
}

type ownerInfo struct{ uid, gid int }

func fileOwner(info os.FileInfo) (ownerInfo, bool) {
	value := reflect.ValueOf(info.Sys())
	if value.Kind() == reflect.Pointer {
		value = value.Elem()
	}
	if !value.IsValid() || value.Kind() != reflect.Struct {
		return ownerInfo{}, false
	}
	uid := value.FieldByName("Uid")
	gid := value.FieldByName("Gid")
	if !uid.IsValid() || !gid.IsValid() || !uid.CanUint() || !gid.CanUint() {
		return ownerInfo{}, false
	}
	return ownerInfo{uid: int(uid.Uint()), gid: int(gid.Uint())}, true
}

func runXrayCommand(binary string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, binary, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return output, fmt.Errorf("%s %s: %w: %s", binary, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return output, nil
}

func waitForXrayAPI(config bo.VlessConfig, timeout time.Duration) error {
	api := NewXrayAPI(config)
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		if _, err := api.QueryStats("", false); err == nil {
			return nil
		} else {
			lastErr = err
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("Xray API did not become ready: %w", lastErr)
}

func (x *XrayAPI) QueryStats(pattern string, reset bool) ([]XrayStat, error) {
	args := []string{"api", "statsquery", "--server=" + x.address, "--pattern=" + pattern}
	if reset {
		args = append(args, "--reset")
	}
	output, err := runXrayCommand(x.binaryPath, args...)
	if err != nil {
		return nil, err
	}
	var response xrayStatsResponse
	if err := json.Unmarshal(output, &response); err != nil {
		return nil, fmt.Errorf("parse Xray statistics: %w", err)
	}
	return response.Stat, nil
}

func (x *XrayAPI) OnlineUsers() (map[string][]string, error) {
	output, err := runXrayCommand(x.binaryPath, "api", "statsonlineiplist", "--server="+x.address, "--all")
	if err != nil {
		return nil, err
	}
	var response xrayOnlineUsersResponse
	if err := json.Unmarshal(output, &response); err != nil {
		return nil, fmt.Errorf("parse Xray online users: %w", err)
	}
	users := make(map[string][]string, len(response.Users))
	for _, user := range response.Users {
		if user.Email == "" {
			continue
		}
		seen := make(map[string]bool, len(user.IPs))
		for _, entry := range user.IPs {
			if entry.IP != "" && !seen[entry.IP] {
				users[user.Email] = append(users[user.Email], entry.IP)
				seen[entry.IP] = true
			}
		}
	}
	return users, nil
}

func (x *XrayAPI) InboundUsers() (map[string]XrayInboundUser, error) {
	output, err := runXrayCommand(x.binaryPath, "api", "inbounduser", "--server="+x.address, "-tag="+x.inboundTag)
	if err != nil {
		return nil, err
	}
	var response xrayInboundUsersResponse
	if err := json.Unmarshal(output, &response); err != nil {
		return nil, fmt.Errorf("parse Xray inbound users: %w", err)
	}
	users := make(map[string]XrayInboundUser, len(response.Users))
	for _, user := range response.Users {
		// Clients without an email stay visible under the empty key: they are
		// invisible to the stats query, so the reconciler has to detect them.
		users[user.Email] = XrayInboundUser{UUID: user.Account.ID, Flow: user.Account.Flow}
	}
	return users, nil
}

func (x *XrayAPI) AddUsers(users []XrayClient) error {
	if len(users) == 0 {
		return nil
	}
	clients := make([]map[string]interface{}, 0, len(users))
	for _, user := range users {
		if user.Email == "" || user.UUID == "" {
			return errors.New("Xray client email and UUID are required")
		}
		client := map[string]interface{}{
			"id":    user.UUID,
			"email": user.Email,
			"level": 0,
		}
		if user.Flow != "" {
			client["flow"] = user.Flow
		}
		clients = append(clients, client)
	}
	data, err := json.Marshal(map[string]interface{}{
		"inbounds": []interface{}{map[string]interface{}{
			"tag":      x.inboundTag,
			"port":     x.port,
			"protocol": "vless",
			"settings": map[string]interface{}{
				"decryption": "none",
				"clients":    clients,
			},
		}},
	})
	if err != nil {
		return err
	}
	dir, err := os.MkdirTemp("", "h-ui-xray-users-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "users.json")
	if err = os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	_, err = runXrayCommand(x.binaryPath, "api", "adu", "--server="+x.address, path)
	return err
}

func (x *XrayAPI) RemoveUsers(emails []string) error {
	for start := 0; start < len(emails); start += 50 {
		end := start + 50
		if end > len(emails) {
			end = len(emails)
		}
		args := []string{"api", "rmu", "--server=" + x.address, "-tag=" + x.inboundTag}
		args = append(args, emails[start:end]...)
		if _, err := runXrayCommand(x.binaryPath, args...); err != nil {
			return err
		}
	}
	return nil
}

func (x *XrayAPI) Port() int { return x.port }

// writeXrayConfig validates a rewritten config and installs it atomically. The
// previous file is restored when the service cannot come back up.
func writeXrayConfig(config bo.VlessConfig, configPath string, original []byte, fileInfo os.FileInfo, root map[string]interface{}, restart bool) error {
	updated, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal Xray config: %w", err)
	}
	updated = append(updated, '\n')

	backupPath := configPath + ".bak-h-ui-" + time.Now().Format("20060102150405")
	if err := copyFileWithMode(configPath, backupPath, fileInfo.Mode().Perm(), fileInfo); err != nil {
		return fmt.Errorf("backup Xray config: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(configPath), ".xray-config-*.json")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err = tmp.Write(updated); err == nil {
		err = tmp.Sync()
	}
	if closeErr := tmp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return fmt.Errorf("write Xray config: %w", err)
	}
	if err = os.Chmod(tmpPath, fileInfo.Mode().Perm()); err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		if owner, ok := fileOwner(fileInfo); ok {
			_ = os.Chown(tmpPath, owner.uid, owner.gid)
		}
	}
	if _, err = runXrayCommand(config.XrayBinaryPath, "run", "-test", "-config", tmpPath); err != nil {
		return fmt.Errorf("validate Xray config: %w", err)
	}
	if err = os.Rename(tmpPath, configPath); err != nil {
		return fmt.Errorf("install Xray config: %w", err)
	}
	if !restart {
		return nil
	}
	if _, err = exec.Command("systemctl", "restart", config.XrayServiceName).CombinedOutput(); err != nil {
		_ = restoreFile(configPath, original, fileInfo)
		_, _ = exec.Command("systemctl", "restart", config.XrayServiceName).CombinedOutput()
		return fmt.Errorf("restart Xray service: %w", err)
	}
	if err = waitForXrayAPI(config, 20*time.Second); err != nil {
		_ = restoreFile(configPath, original, fileInfo)
		_, _ = exec.Command("systemctl", "restart", config.XrayServiceName).CombinedOutput()
		return err
	}
	return nil
}
