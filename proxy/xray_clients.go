package proxy

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"h-ui/model/bo"
)

// XrayInboundClient is one static client entry of the managed inbound. Xray
// attributes traffic statistics to the client email, so an entry without one
// uses the node without ever being billed. h-ui therefore only persists clients
// that belong to an account, and drops whatever else it finds.
type XrayInboundClient struct {
	UUID  string
	Email string
	Flow  string
}

// NormalizeInboundClients rewrites the client list of the inbound with the given
// tag so it matches clients exactly. Returns true when the document changed.
func NormalizeInboundClients(root map[string]interface{}, tag string, clients []XrayInboundClient) (bool, error) {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return false, errors.New("inbound tag is required")
	}
	inbounds, ok := root["inbounds"].([]interface{})
	if !ok {
		return false, errors.New("Xray config has no inbound list")
	}
	var target map[string]interface{}
	for _, raw := range inbounds {
		inbound, ok := raw.(map[string]interface{})
		if ok && inbound["tag"] == tag {
			target = inbound
			break
		}
	}
	if target == nil {
		return false, fmt.Errorf("inbound %q not found in the Xray config", tag)
	}
	settings, ok := target["settings"].(map[string]interface{})
	if !ok {
		settings = map[string]interface{}{}
		target["settings"] = settings
	}

	desired := make([]interface{}, 0, len(clients))
	seen := make(map[string]struct{}, len(clients))
	for _, client := range clients {
		uuid := strings.TrimSpace(client.UUID)
		if uuid == "" {
			continue
		}
		email := strings.TrimSpace(client.Email)
		if email == "" {
			return false, fmt.Errorf("Xray client %s has no email and would not be billed", uuid)
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		entry := map[string]interface{}{"id": uuid, "email": email, "level": 0}
		if flow := strings.TrimSpace(client.Flow); flow != "" {
			entry["flow"] = flow
		}
		desired = append(desired, entry)
	}

	current, _ := settings["clients"].([]interface{})
	if inboundClientsEqual(current, desired) {
		return false, nil
	}
	settings["clients"] = desired
	return true, nil
}

func inboundClientsEqual(current []interface{}, desired []interface{}) bool {
	if len(current) != len(desired) {
		return false
	}
	byEmail := make(map[string]map[string]interface{}, len(desired))
	for _, raw := range desired {
		entry, ok := raw.(map[string]interface{})
		if !ok {
			return false
		}
		byEmail[entry["email"].(string)] = entry
	}
	for _, raw := range current {
		existing, ok := raw.(map[string]interface{})
		if !ok {
			return false
		}
		email := strings.TrimSpace(fmt.Sprint(existing["email"]))
		want, ok := byEmail[email]
		if !ok {
			return false
		}
		delete(byEmail, email)
		if strings.TrimSpace(fmt.Sprint(existing["id"])) != want["id"] {
			return false
		}
		if clientFlow(existing) != clientFlow(want) {
			return false
		}
	}
	return len(byEmail) == 0
}

func clientFlow(entry map[string]interface{}) string {
	flow, ok := entry["flow"]
	if !ok || flow == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(flow))
}

// SyncInboundClients persists the billable client list into the Xray config
// file. The running service is left alone: h-ui keeps the live user set in sync
// through the Xray API, this only guarantees that a restart starts from a state
// where every client is billed.
func SyncInboundClients(config bo.VlessConfig, clients []XrayInboundClient) (bool, error) {
	configPath := filepath.Clean(strings.TrimSpace(config.XrayConfigPath))
	if configPath == "" || configPath == "." {
		return false, errors.New("Xray config path is required")
	}
	original, err := os.ReadFile(configPath)
	if err != nil {
		return false, fmt.Errorf("read Xray config: %w", err)
	}
	fileInfo, err := os.Stat(configPath)
	if err != nil {
		return false, fmt.Errorf("stat Xray config: %w", err)
	}
	var root map[string]interface{}
	decoder := json.NewDecoder(bytes.NewReader(original))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		return false, fmt.Errorf("parse Xray config: %w", err)
	}
	changed, err := NormalizeInboundClients(root, config.XrayInboundTag, clients)
	if err != nil || !changed {
		return changed, err
	}
	if err := writeXrayConfig(config, configPath, original, fileInfo, root, false); err != nil {
		return false, err
	}
	return true, nil
}
