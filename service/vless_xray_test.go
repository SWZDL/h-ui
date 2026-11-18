package service

import (
	"testing"
	"time"

	"h-ui/model/bo"
	"h-ui/model/entity"
)

func allowedVlessAccount(t *testing.T, id int64, username string, uuid string, quota int64, used int64) entity.Account {
	t.Helper()
	deleted, zero := int64(0), int64(0)
	expire, kick, devices := time.Now().Add(time.Hour).UnixMilli(), int64(0), int64(5)
	return entity.Account{
		BaseEntity:   entity.BaseEntity{Id: &id},
		Username:     &username,
		Deleted:      &deleted,
		VlessUUID:    &uuid,
		Quota:        &quota,
		Download:     &used,
		Upload:       &zero,
		ExpireTime:   &expire,
		KickUtilTime: &kick,
		DeviceNo:     &devices,
	}
}

func TestVlessInboundClientsOnlyListsBillableAccounts(t *testing.T) {
	accounts := []entity.Account{
		allowedVlessAccount(t, 7, "alice", "11111111-1111-4111-8111-111111111111", 1000, 0),
		allowedVlessAccount(t, 8, "bob", "22222222-2222-4222-8222-222222222222", 100, 200),
		allowedVlessAccount(t, 9, "carol", "", 1000, 0),
	}
	config := bo.VlessConfig{Flow: "xtls-rprx-vision"}
	clients := vlessInboundClients(accounts, config)
	if len(clients) != 1 {
		t.Fatalf("only the billable account may become an Xray client: %#v", clients)
	}
	if clients[0].Email != "h-ui-account-7" {
		t.Fatalf("unexpected client email: %q", clients[0].Email)
	}
	if clients[0].UUID != "11111111-1111-4111-8111-111111111111" {
		t.Fatalf("unexpected client UUID: %q", clients[0].UUID)
	}
	if clients[0].Flow != "xtls-rprx-vision" {
		t.Fatalf("the manager flow must be persisted with the client: %q", clients[0].Flow)
	}
}
