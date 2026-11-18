package service

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
	"h-ui/model/bo"
	"h-ui/model/entity"
)

func TestBuildVlessRealityURL(t *testing.T) {
	config := bo.VlessConfig{
		Address:     "2001:db8::1",
		Port:        8443,
		Network:     "tcp",
		Security:    "reality",
		Remark:      "edge",
		SNI:         "cdn.example.com",
		Fingerprint: "chrome",
		PublicKey:   "test-public-key",
		ShortID:     "abcd",
		SpiderX:     "/health check",
		Flow:        "xtls-rprx-vision",
	}
	link := BuildVlessSubscriptionURL(config, "11111111-1111-4111-8111-111111111111", "alice", "")
	parsed, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse VLESS URL: %v", err)
	}
	if parsed.Scheme != "vless" || parsed.Host != "[2001:db8::1]:8443" {
		t.Fatalf("unexpected endpoint: %s", link)
	}
	if parsed.User.Username() != "11111111-1111-4111-8111-111111111111" {
		t.Fatalf("unexpected UUID: %q", parsed.User.Username())
	}
	query := parsed.Query()
	for key, want := range map[string]string{
		"encryption": "none",
		"type":       "tcp",
		"security":   "reality",
		"sni":        "cdn.example.com",
		"fp":         "chrome",
		"pbk":        "test-public-key",
		"sid":        "abcd",
		"spx":        "/health check",
		"flow":       "xtls-rprx-vision",
	} {
		if got := query.Get(key); got != want {
			t.Errorf("query %s: got %q, want %q", key, got, want)
		}
	}
	if parsed.Fragment != "edge - alice" {
		t.Fatalf("unexpected node name: %q", parsed.Fragment)
	}
}

func TestBuildVlessWebsocketURL(t *testing.T) {
	config := bo.VlessConfig{
		Address:  "vless.example.com",
		Port:     443,
		Network:  "ws",
		Security: "tls",
		Path:     "/tunnel",
		Host:     "ws.example.com",
	}
	parsed, err := url.Parse(BuildVlessSubscriptionURL(config, "uuid", "alice", ""))
	if err != nil {
		t.Fatalf("parse VLESS URL: %v", err)
	}
	if parsed.Query().Get("path") != "/tunnel" || parsed.Query().Get("host") != "ws.example.com" {
		t.Fatalf("WebSocket parameters missing from VLESS URL: %s", parsed.String())
	}
}

func TestMergeClashSubscriptionsIncludesBothProtocols(t *testing.T) {
	hysteria2 := `proxies:
  - name: H2
    type: hysteria2
proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - H2
`
	vless, err := BuildVlessClashSubscription(bo.VlessConfig{
		Address: "vless.example.com", Port: 443, Network: "tcp", Security: "tls",
	}, "11111111-1111-4111-8111-111111111111", "alice", "")
	if err != nil {
		t.Fatalf("build VLESS Clash subscription: %v", err)
	}
	combined, err := mergeClashSubscriptions(hysteria2, vless)
	if err != nil {
		t.Fatalf("merge Clash subscriptions: %v", err)
	}
	var parsed struct {
		Proxies []map[string]interface{} `yaml:"proxies"`
		Groups  []struct {
			Name    string   `yaml:"name"`
			Proxies []string `yaml:"proxies"`
		} `yaml:"proxy-groups"`
	}
	if err := yaml.Unmarshal([]byte(combined), &parsed); err != nil {
		t.Fatalf("parse merged Clash subscription: %v", err)
	}
	if len(parsed.Proxies) != 2 || len(parsed.Groups) != 1 || len(parsed.Groups[0].Proxies) != 2 {
		t.Fatalf("merged subscription should contain both proxies in one group: %s", combined)
	}
	proxyTypes := map[string]bool{}
	for _, proxy := range parsed.Proxies {
		proxyTypes[proxy["type"].(string)] = true
	}
	if !proxyTypes["hysteria2"] || !proxyTypes["vless"] {
		t.Fatalf("combined subscription missing protocol proxy types: %#v", proxyTypes)
	}
}

func TestBuildVlessClashConfigHasProxyAndGroup(t *testing.T) {
	config := bo.VlessConfig{
		Address:     "vless.example.com",
		Port:        443,
		Network:     "grpc",
		Security:    "tls",
		Remark:      "main",
		SNI:         "tls.example.com",
		ServiceName: "proxy",
	}
	content, err := BuildVlessClashSubscription(config, "11111111-1111-4111-8111-111111111111", "alice", "")
	if err != nil {
		t.Fatalf("build Clash subscription: %v", err)
	}
	for _, expected := range []string{
		"type: vless",
		"server: vless.example.com",
		"uuid: 11111111-1111-4111-8111-111111111111",
		"grpc-service-name: proxy",
		"name: main - alice",
		"PROXY",
	} {
		if !strings.Contains(content, expected) {
			t.Errorf("Clash YAML missing %q:\n%s", expected, content)
		}
	}
}

func TestVlessAccountAllowedAppliesQuotaExpiryKickAndDeviceState(t *testing.T) {
	now := time.Now().UnixMilli()
	id, deleted, quota := int64(7), int64(0), int64(100)
	download, upload := int64(40), int64(50)
	expire, kick, devices := now+60_000, now-1, int64(2)
	uuid := "11111111-1111-4111-8111-111111111111"
	account := entity.Account{
		BaseEntity: entity.BaseEntity{Id: &id},
		Deleted:    &deleted, Quota: &quota, Download: &download, Upload: &upload,
		ExpireTime: &expire, KickUtilTime: &kick, DeviceNo: &devices, VlessUUID: &uuid,
	}
	if !vlessAccountAllowed(account, now) {
		t.Fatal("eligible account was rejected")
	}
	quota = 90
	if vlessAccountAllowed(account, now) {
		t.Fatal("account at/over quota was allowed")
	}
	quota = -1
	expire = now
	if vlessAccountAllowed(account, now) {
		t.Fatal("expired account was allowed")
	}
	expire = now + 60_000
	kick = now + 1
	if vlessAccountAllowed(account, now) {
		t.Fatal("kicked account was allowed")
	}
	kick = now - 1
	devices = 0
	if vlessAccountAllowed(account, now) {
		t.Fatal("account without a device allowance was allowed")
	}
}

func TestValidateVlessConfigRequiresRealityKeys(t *testing.T) {
	config := bo.VlessConfig{
		Enabled:  true,
		Address:  "vless.example.com",
		Port:     443,
		Network:  "tcp",
		Security: "reality",
	}
	if err := validateVlessConfig(config); err == nil {
		t.Fatal("expected Reality settings to be required")
	}
	config.PublicKey = "public"
	config.ShortID = "1234"
	config = normalizeVlessConfig(config)
	if err := validateVlessConfig(config); err != nil {
		t.Fatalf("valid Reality config rejected: %v", err)
	}
}
