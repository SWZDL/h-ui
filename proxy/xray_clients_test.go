package proxy

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func inboundRoot(t *testing.T, clients ...interface{}) map[string]interface{} {
	t.Helper()
	raw := `{
		"inbounds": [
			{
				"tag": "h-ui-vless",
				"port": 443,
				"protocol": "vless",
				"settings": {"decryption": "none", "clients": ` + mustJSON(t, clients) + `}
			},
			{"tag": "api", "port": 10085, "protocol": "dokodemo-door"}
		]
	}`
	var root map[string]interface{}
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	return root
}

func mustJSON(t *testing.T, value interface{}) string {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	return string(data)
}

func inboundClients(t *testing.T, root map[string]interface{}) []interface{} {
	t.Helper()
	inbounds := root["inbounds"].([]interface{})
	settings := inbounds[0].(map[string]interface{})["settings"].(map[string]interface{})
	clients, _ := settings["clients"].([]interface{})
	return clients
}

func TestNormalizeInboundClientsDropsUnbilledClients(t *testing.T) {
	root := inboundRoot(t,
		map[string]interface{}{"id": "anonymous-uuid", "flow": "xtls-rprx-vision"},
		map[string]interface{}{"id": "account-uuid", "email": "h-ui-account-1", "level": 0, "flow": "xtls-rprx-vision"},
		map[string]interface{}{"id": "stranger-uuid", "email": "someone-else", "level": 0},
	)
	changed, err := NormalizeInboundClients(root, "h-ui-vless", []XrayInboundClient{
		{UUID: "account-uuid", Email: "h-ui-account-1", Flow: "xtls-rprx-vision"},
		{UUID: "new-uuid", Email: "h-ui-account-2", Flow: "xtls-rprx-vision"},
	})
	if err != nil {
		t.Fatalf("normalize clients: %v", err)
	}
	if !changed {
		t.Fatal("expected the client list to change")
	}
	clients := inboundClients(t, root)
	if len(clients) != 2 {
		t.Fatalf("unexpected client count: %s", mustJSON(t, clients))
	}
	for _, raw := range clients {
		client := raw.(map[string]interface{})
		email, _ := client["email"].(string)
		if !strings.HasPrefix(email, "h-ui-account-") {
			t.Fatalf("unbilled client survived: %s", mustJSON(t, client))
		}
		if fmt.Sprint(client["level"]) != "0" {
			t.Fatalf("client level must stay 0 for the stats policy: %s", mustJSON(t, client))
		}
	}

	changed, err = NormalizeInboundClients(root, "h-ui-vless", []XrayInboundClient{
		{UUID: "account-uuid", Email: "h-ui-account-1", Flow: "xtls-rprx-vision"},
		{UUID: "new-uuid", Email: "h-ui-account-2", Flow: "xtls-rprx-vision"},
	})
	if err != nil {
		t.Fatalf("normalize clients again: %v", err)
	}
	if changed {
		t.Fatal("normalizing twice must be idempotent")
	}
}

func TestNormalizeInboundClientsKeepsClientWithoutFlow(t *testing.T) {
	root := inboundRoot(t, map[string]interface{}{"id": "old", "email": "h-ui-account-1", "level": 0})
	changed, err := NormalizeInboundClients(root, "h-ui-vless", []XrayInboundClient{
		{UUID: "plain-uuid", Email: "h-ui-account-1"},
	})
	if err != nil {
		t.Fatalf("normalize clients: %v", err)
	}
	if !changed {
		t.Fatal("expected the UUID change to be detected")
	}
	clients := inboundClients(t, root)
	client := clients[0].(map[string]interface{})
	if client["id"] != "plain-uuid" {
		t.Fatalf("unexpected client: %s", mustJSON(t, client))
	}
	if _, ok := client["flow"]; ok {
		t.Fatalf("flow must be omitted when unset: %s", mustJSON(t, client))
	}
}

func TestNormalizeInboundClientsRejectsUnbilledInput(t *testing.T) {
	root := inboundRoot(t)
	if _, err := NormalizeInboundClients(root, "h-ui-vless", []XrayInboundClient{{UUID: "uuid"}}); err == nil {
		t.Fatal("expected a client without email to be rejected")
	}
	if _, err := NormalizeInboundClients(root, "", []XrayInboundClient{{UUID: "uuid", Email: "h-ui-account-1"}}); err == nil {
		t.Fatal("expected an empty inbound tag to be rejected")
	}
	if _, err := NormalizeInboundClients(root, "missing", []XrayInboundClient{{UUID: "uuid", Email: "h-ui-account-1"}}); err == nil {
		t.Fatal("expected an unknown inbound tag to be rejected")
	}
}

func TestNormalizeInboundClientsIgnoresDuplicateEmails(t *testing.T) {
	root := inboundRoot(t)
	changed, err := NormalizeInboundClients(root, "h-ui-vless", []XrayInboundClient{
		{UUID: "first", Email: "h-ui-account-1"},
		{UUID: "second", Email: "h-ui-account-1"},
		{UUID: "", Email: "h-ui-account-2"},
	})
	if err != nil {
		t.Fatalf("normalize clients: %v", err)
	}
	if !changed {
		t.Fatal("expected the client list to change")
	}
	clients := inboundClients(t, root)
	if len(clients) != 1 {
		t.Fatalf("duplicate email or empty UUID was kept: %s", mustJSON(t, clients))
	}
	if clients[0].(map[string]interface{})["id"] != "first" {
		t.Fatalf("first client for an email should win: %s", mustJSON(t, clients))
	}
}
