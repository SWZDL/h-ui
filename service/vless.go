package service

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"h-ui/dao"
	"h-ui/model/bo"
	"h-ui/model/constant"
	"h-ui/model/entity"
	"h-ui/proxy"

	"gopkg.in/yaml.v3"
)

func DefaultVlessConfig() bo.VlessConfig {
	return bo.VlessConfig{
		Port:            443,
		Network:         "tcp",
		Security:        "tls",
		Remark:          "VLESS",
		Fingerprint:     "chrome",
		ALPN:            []string{},
		XrayConfigPath:  "/etc/xray/config.json",
		XrayServiceName: "xray",
		XrayAPIAddress:  "127.0.0.1:10085",
		XrayInboundTag:  "h-ui-vless",
		XrayBinaryPath:  "/usr/local/bin/xray",
	}
}

func GetVlessConfig() (bo.VlessConfig, error) {
	config, err := dao.GetConfig("key = ?", constant.VlessConfig)
	if err != nil {
		return bo.VlessConfig{}, err
	}
	result := DefaultVlessConfig()
	if config.Value == nil || *config.Value == "" {
		return result, nil
	}
	if err = json.Unmarshal([]byte(*config.Value), &result); err != nil {
		return bo.VlessConfig{}, fmt.Errorf("invalid VLESS config: %w", err)
	}
	return normalizeVlessConfig(result), nil
}

func SetVlessConfig(config bo.VlessConfig) error {
	config = normalizeVlessConfig(config)
	if err := validateVlessConfig(config); err != nil {
		return err
	}
	previous, err := GetVlessConfig()
	if err != nil {
		return err
	}
	if config.Enabled {
		if err := proxy.ConfigureXrayAPI(config); err != nil {
			return err
		}
	}
	content, err := json.Marshal(config)
	if err != nil {
		return err
	}
	if !config.Enabled && previous.Enabled {
		if err := RemoveManagedVlessUsers(previous); err != nil {
			return fmt.Errorf("remove managed VLESS users: %w", err)
		}
	}
	if err = dao.UpdateConfig([]string{constant.VlessConfig}, map[string]interface{}{"value": string(content)}); err != nil {
		return err
	}
	if config.Enabled {
		CronHandleVless()
	}
	return nil
}

func normalizeVlessConfig(config bo.VlessConfig) bo.VlessConfig {
	defaults := DefaultVlessConfig()
	if config.Port == 0 {
		config.Port = defaults.Port
	}
	if config.Network == "" {
		config.Network = defaults.Network
	}
	if config.Security == "" {
		config.Security = defaults.Security
	}
	if config.Remark == "" {
		config.Remark = defaults.Remark
	}
	if config.Fingerprint == "" && config.Security != "none" {
		config.Fingerprint = defaults.Fingerprint
	}
	if config.ALPN == nil {
		config.ALPN = []string{}
	}
	if config.XrayConfigPath == "" {
		config.XrayConfigPath = defaults.XrayConfigPath
	}
	if config.XrayServiceName == "" {
		config.XrayServiceName = defaults.XrayServiceName
	}
	if config.XrayAPIAddress == "" {
		config.XrayAPIAddress = defaults.XrayAPIAddress
	}
	if config.XrayInboundTag == "" {
		config.XrayInboundTag = defaults.XrayInboundTag
	}
	if config.XrayBinaryPath == "" {
		config.XrayBinaryPath = defaults.XrayBinaryPath
	}
	return config
}

func validateVlessConfig(config bo.VlessConfig) error {
	if !config.Enabled {
		return nil
	}
	if strings.TrimSpace(config.XrayConfigPath) == "" || strings.TrimSpace(config.XrayServiceName) == "" ||
		strings.TrimSpace(config.XrayAPIAddress) == "" || strings.TrimSpace(config.XrayInboundTag) == "" ||
		strings.TrimSpace(config.XrayBinaryPath) == "" {
		return errors.New("Xray API and inbound settings are required")
	}
	address := strings.Trim(strings.TrimSpace(config.Address), "[]")
	if address == "" || strings.ContainsAny(address, "/?#@ \t\r\n") {
		return errors.New("a valid VLESS server address is required")
	}
	if config.Port < 1 || config.Port > 65535 {
		return errors.New("VLESS port must be between 1 and 65535")
	}
	if config.Network != "tcp" && config.Network != "ws" && config.Network != "grpc" {
		return errors.New("VLESS network must be tcp, ws, or grpc")
	}
	if config.Security != "none" && config.Security != "tls" && config.Security != "reality" {
		return errors.New("VLESS security must be none, tls, or reality")
	}
	if config.Security == "reality" {
		if config.Network != "tcp" {
			return errors.New("Reality currently requires TCP transport")
		}
		if strings.TrimSpace(config.PublicKey) == "" || strings.TrimSpace(config.ShortID) == "" {
			return errors.New("Reality public key and short ID are required")
		}
	}
	if config.Flow != "" {
		if config.Flow != "xtls-rprx-vision" {
			return errors.New("unsupported VLESS flow")
		}
		if config.Network != "tcp" || config.Security == "none" {
			return errors.New("VLESS vision flow requires TCP and TLS or Reality")
		}
	}
	return nil
}

func VlessUrl(accountId int64) (string, error) {
	config, err := GetVlessConfig()
	if err != nil {
		return "", err
	}
	if !config.Enabled {
		return "", errors.New("VLESS is disabled")
	}
	if err = validateVlessConfig(config); err != nil {
		return "", err
	}
	account, err := dao.GetAccount("id = ?", accountId)
	if err != nil {
		return "", err
	}
	if !vlessAccountAllowed(account, time.Now().UnixMilli()) {
		return "", errors.New("VLESS account is disabled, expired, or over quota")
	}
	return buildVlessURL(config, account), nil
}

func VlessSubscribeUrl(accountId int64, protocol string, host string) (string, error) {
	config, err := GetVlessConfig()
	if err != nil {
		return "", err
	}
	if !config.Enabled {
		return "", errors.New("VLESS is disabled")
	}
	if err = validateVlessConfig(config); err != nil {
		return "", err
	}
	account, err := dao.GetAccount("id = ?", accountId)
	if err != nil {
		return "", err
	}
	if !vlessAccountAllowed(account, time.Now().UnixMilli()) {
		return "", errors.New("VLESS account is disabled, expired, or over quota")
	}
	if protocol != "http:" && protocol != "https:" && protocol != "http" && protocol != "https" {
		return "", errors.New("invalid subscription protocol")
	}
	protocol = strings.TrimSuffix(protocol, ":")
	parsed, err := url.Parse("//" + host)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("invalid subscription host")
	}
	panelConfig, err := dao.GetConfig("key = ?", constant.HUIWebContext)
	if err != nil {
		return "", err
	}
	webContext := ""
	if panelConfig.Value != nil && *panelConfig.Value != "/" && strings.HasPrefix(*panelConfig.Value, "/") {
		webContext = strings.TrimSuffix(*panelConfig.Value, "/")
	}
	return fmt.Sprintf("%s://%s%s/hui/vless/subscribe/%s", protocol, parsed.Host, webContext, url.PathEscape(valueOrEmpty(account.ConPass))), nil
}

func VlessSubscribe(conPass string, clientType string) (string, string, error) {
	config, err := GetVlessConfig()
	if err != nil {
		return "", "", err
	}
	if !config.Enabled {
		return "", "", errors.New("VLESS is disabled")
	}
	if err = validateVlessConfig(config); err != nil {
		return "", "", err
	}
	account, err := dao.GetAccount("con_pass = ?", conPass)
	if err != nil {
		return "", "", err
	}
	if !vlessAccountAllowed(account, time.Now().UnixMilli()) {
		return "", "", errors.New("VLESS account is disabled, expired, or over quota")
	}
	link := buildVlessURL(config, account)
	userInfo := fmt.Sprintf("upload=%d; download=%d; total=%d; expire=%d",
		valueOrZero(account.Upload), valueOrZero(account.Download), valueOrZero(account.Quota), valueOrZero(account.ExpireTime)/1000)
	if clientType == constant.Clash {
		content, err := buildClashVlessConfig(config, account)
		return userInfo, content, err
	}
	return userInfo, base64.StdEncoding.EncodeToString([]byte(link)), nil
}

func buildVlessURL(config bo.VlessConfig, account entity.Account) string {
	return buildVlessConfigURL(config, valueOrEmpty(account.VlessUUID), valueOrEmpty(account.Username), valueOrEmpty(account.Remark))
}

func buildVlessConfigURL(config bo.VlessConfig, uuid string, username string, accountRemark string) string {
	values := url.Values{}
	values.Set("encryption", "none")
	values.Set("type", config.Network)
	values.Set("security", config.Security)

	serverName := strings.TrimSpace(config.SNI)
	if serverName == "" {
		serverName = strings.Trim(strings.TrimSpace(config.Address), "[]")
	}
	if config.Security != "none" {
		values.Set("sni", serverName)
		if config.Fingerprint != "" {
			values.Set("fp", config.Fingerprint)
		}
		if len(config.ALPN) > 0 {
			values.Set("alpn", strings.Join(config.ALPN, ","))
		}
	}
	if config.Security == "tls" && config.AllowInsecure {
		values.Set("allowInsecure", "1")
	}
	if config.Security == "reality" {
		values.Set("pbk", config.PublicKey)
		values.Set("sid", config.ShortID)
		if config.SpiderX != "" {
			values.Set("spx", config.SpiderX)
		}
	}
	if config.Flow != "" {
		values.Set("flow", config.Flow)
	}
	switch config.Network {
	case "ws":
		path := config.Path
		if path == "" {
			path = "/"
		}
		values.Set("path", path)
		if config.Host != "" {
			values.Set("host", config.Host)
		}
	case "grpc":
		if config.ServiceName != "" {
			values.Set("serviceName", config.ServiceName)
		}
	}

	name := accountRemark
	if name == "" {
		name = username
	}
	if config.Remark != "" {
		name = config.Remark + " - " + name
	}
	serverAddress := strings.Trim(strings.TrimSpace(config.Address), "[]")
	endpoint := &url.URL{
		Scheme:   "vless",
		User:     url.User(uuid),
		Host:     net.JoinHostPort(serverAddress, strconv.Itoa(config.Port)),
		RawQuery: values.Encode(),
		Fragment: name,
	}
	return endpoint.String()
}

func buildClashVlessConfig(config bo.VlessConfig, account entity.Account) (string, error) {
	return buildClashVlessConfigForAccount(config, valueOrEmpty(account.VlessUUID), valueOrEmpty(account.Username), valueOrEmpty(account.Remark))
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func valueOrZero(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

type clashVlessProxy struct {
	Name              string            `yaml:"name"`
	Type              string            `yaml:"type"`
	Server            string            `yaml:"server"`
	Port              int               `yaml:"port"`
	UUID              string            `yaml:"uuid"`
	TLS               bool              `yaml:"tls,omitempty"`
	ServerName        string            `yaml:"servername,omitempty"`
	ClientFingerprint string            `yaml:"client-fingerprint,omitempty"`
	Flow              string            `yaml:"flow,omitempty"`
	ALPN              []string          `yaml:"alpn,omitempty"`
	SkipCertVerify    bool              `yaml:"skip-cert-verify,omitempty"`
	RealityOpts       *clashRealityOpts `yaml:"reality-opts,omitempty"`
	WSOpts            *clashWSOpts      `yaml:"ws-opts,omitempty"`
	GRPCOpts          *clashGRPCOpts    `yaml:"grpc-opts,omitempty"`
}

type clashRealityOpts struct {
	PublicKey string `yaml:"public-key"`
	ShortID   string `yaml:"short-id"`
}

type clashWSOpts struct {
	Path    string            `yaml:"path"`
	Headers map[string]string `yaml:"headers,omitempty"`
}

type clashGRPCOpts struct {
	GRPCServiceName string `yaml:"grpc-service-name,omitempty"`
}

type clashVlessGroup struct {
	Name    string   `yaml:"name"`
	Type    string   `yaml:"type"`
	Proxies []string `yaml:"proxies"`
}

type clashVlessSubscription struct {
	Proxies     []clashVlessProxy `yaml:"proxies"`
	ProxyGroups []clashVlessGroup `yaml:"proxy-groups"`
}

func buildClashVlessConfigForAccount(config bo.VlessConfig, uuid string, username string, accountRemark string) (string, error) {
	name := accountRemark
	if name == "" {
		name = username
	}
	if config.Remark != "" {
		name = config.Remark + " - " + name
	}
	proxyConfig := clashVlessProxy{
		Name:           name,
		Type:           "vless",
		Server:         strings.Trim(strings.TrimSpace(config.Address), "[]"),
		Port:           config.Port,
		UUID:           uuid,
		TLS:            config.Security != "none",
		Flow:           config.Flow,
		SkipCertVerify: config.Security == "tls" && config.AllowInsecure,
	}
	if config.Security != "none" {
		proxyConfig.ServerName = config.SNI
		if proxyConfig.ServerName == "" {
			proxyConfig.ServerName = proxyConfig.Server
		}
		proxyConfig.ClientFingerprint = config.Fingerprint
		proxyConfig.ALPN = config.ALPN
	}
	if config.Security == "reality" {
		proxyConfig.RealityOpts = &clashRealityOpts{PublicKey: config.PublicKey, ShortID: config.ShortID}
	}
	if config.Network == "ws" {
		path := config.Path
		if path == "" {
			path = "/"
		}
		proxyConfig.WSOpts = &clashWSOpts{Path: path}
		if config.Host != "" {
			proxyConfig.WSOpts.Headers = map[string]string{"Host": config.Host}
		}
	}
	if config.Network == "grpc" {
		proxyConfig.GRPCOpts = &clashGRPCOpts{GRPCServiceName: config.ServiceName}
	}

	result := clashVlessSubscription{
		Proxies: []clashVlessProxy{proxyConfig},
		ProxyGroups: []clashVlessGroup{{
			Name:    "PROXY",
			Type:    "select",
			Proxies: []string{name},
		}},
	}
	content, err := yaml.Marshal(result)
	return string(content), err
}

func BuildVlessSubscriptionURL(config bo.VlessConfig, uuid string, username string, remark string) string {
	return buildVlessConfigURL(config, uuid, username, remark)
}

func BuildVlessClashSubscription(config bo.VlessConfig, uuid string, username string, remark string) (string, error) {
	return buildClashVlessConfigForAccount(config, uuid, username, remark)
}
