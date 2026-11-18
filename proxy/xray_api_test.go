package proxy

import (
	"encoding/json"
	"testing"

	"h-ui/model/bo"
)

func TestEnsureXrayManagementConfigIsIdempotent(t *testing.T) {
	root := map[string]interface{}{
		"inbounds": []interface{}{map[string]interface{}{
			"tag": "existing-vless", "port": json.Number("443"), "protocol": "vless",
			"settings": map[string]interface{}{"clients": []interface{}{}},
		}},
		"outbounds": []interface{}{},
	}
	config := bo.VlessConfig{Port: 443, XrayInboundTag: "h-ui-vless"}
	changed, err := ensureXrayManagementConfig(root, config, 10085)
	if err != nil {
		t.Fatalf("configure Xray management: %v", err)
	}
	if !changed {
		t.Fatal("expected Xray config to change")
	}
	inbounds := root["inbounds"].([]interface{})
	if len(inbounds) != 2 {
		t.Fatalf("expected VLESS and API inbounds, got %d", len(inbounds))
	}
	if got := inbounds[0].(map[string]interface{})["tag"]; got != "h-ui-vless" {
		t.Fatalf("VLESS inbound tag = %v", got)
	}

	changed, err = ensureXrayManagementConfig(root, config, 10085)
	if err != nil {
		t.Fatalf("recheck Xray management: %v", err)
	}
	if changed {
		t.Fatal("second configuration pass should be idempotent")
	}
}
