package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"h-ui/dao"
	"h-ui/model/constant"
	"h-ui/model/entity"
)

func setupProxySubscriptionTest(t *testing.T) {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o755); err != nil {
		t.Fatalf("create data directory: %v", err)
	}
	t.Setenv("HUI_DATA", root+string(os.PathSeparator))
	if err := dao.InitSql(""); err != nil {
		t.Fatalf("initialize test database: %v", err)
	}
	t.Cleanup(func() { _ = dao.CloseSqliteDB() })

	username, password, conPass, role, remark := "alice", "password", "alice.password", "user", "test account"
	quota, zero, expire, devices := int64(-1), int64(0), int64(253370736000000), int64(3)
	if _, err := dao.SaveAccount(entity.Account{
		Username: &username, Pass: &password, ConPass: &conPass, Quota: &quota,
		Download: &zero, Upload: &zero, ExpireTime: &expire, KickUtilTime: &zero,
		DeviceNo: &devices, Role: &role, Deleted: &zero, Remark: &remark,
	}); err != nil {
		t.Fatalf("save test account: %v", err)
	}

	vlessConfig, err := json.Marshal(map[string]interface{}{
		"enabled": true, "address": "vless.example.com", "port": 443,
		"network": "tcp", "security": "reality", "remark": "VLESS",
		"sni": "vless.example.com", "fingerprint": "chrome",
		"publicKey": "public-key", "shortId": "1234", "flow": "xtls-rprx-vision",
		"alpn": []string{},
	})
	if err != nil {
		t.Fatalf("marshal VLESS config: %v", err)
	}
	if err := dao.UpdateConfig([]string{constant.VlessConfig}, map[string]interface{}{"value": string(vlessConfig)}); err != nil {
		t.Fatalf("set VLESS config: %v", err)
	}
	if err := dao.UpdateConfig([]string{constant.Hysteria2Config}, map[string]interface{}{"value": `listen: ":443"`}); err != nil {
		t.Fatalf("set Hysteria2 config: %v", err)
	}
}

func TestSubscriptionContainsOnlyRunningProtocols(t *testing.T) {
	setupProxySubscriptionTest(t)
	conPass, host := "alice.password", "panel.example.com:8099"

	tests := []struct {
		name          string
		hysteria2     bool
		vless         bool
		userAgent     string
		wantHysteria2 bool
		wantVless     bool
	}{
		{name: "both-running-clash", hysteria2: true, vless: true, userAgent: constant.Clash, wantHysteria2: true, wantVless: true},
		{name: "vless-only-clash", vless: true, userAgent: constant.Clash, wantVless: true},
		{name: "hysteria2-only-clash", hysteria2: true, userAgent: constant.Clash, wantHysteria2: true},
		{name: "both-running-v2rayn", hysteria2: true, vless: true, userAgent: constant.V2rayN, wantHysteria2: true, wantVless: true},
		{name: "vless-only-v2rayn", vless: true, userAgent: constant.V2rayN, wantVless: true},
		{name: "hysteria2-only-v2rayn", hysteria2: true, userAgent: constant.V2rayN, wantHysteria2: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, content, err := proxySubscribeForRunningServices(conPass, test.userAgent, host, test.hysteria2, test.vless)
			if err != nil {
				t.Fatalf("build subscription: %v", err)
			}
			if test.userAgent == constant.V2rayN {
				if test.wantHysteria2 != strings.Contains(content, "hysteria2://") || test.wantVless != strings.Contains(content, "vless://") {
					t.Fatalf("subscription protocol mismatch: %q", content)
				}
				return
			}
			if test.wantHysteria2 != strings.Contains(content, "type: hysteria2") || test.wantVless != strings.Contains(content, "type: vless") {
				t.Fatalf("subscription protocol mismatch: %q", content)
			}
			if test.wantVless && !strings.Contains(content, "network: tcp") {
				t.Fatalf("VLESS transport missing: %q", content)
			}
		})
	}

	if _, _, err := proxySubscribeForRunningServices(conPass, constant.Clash, host, false, false); err == nil {
		t.Fatal("expected an error when no proxy service is running")
	}
}

func TestVlessOnlyNekoBoxSubscriptionContainsOnlyVless(t *testing.T) {
	setupProxySubscriptionTest(t)
	_, content, err := proxySubscribeForRunningServices("alice.password", constant.NekoBox, "panel.example.com:8099", false, true)
	if err != nil {
		t.Fatalf("build VLESS-only NekoBox subscription: %v", err)
	}
	if !strings.Contains(content, "vless://") || strings.Contains(content, "hysteria2://") {
		t.Fatalf("unexpected VLESS-only subscription content: %q", content)
	}
}
