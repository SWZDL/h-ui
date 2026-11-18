package dao

import (
	"os"
	"path/filepath"
	"testing"

	"h-ui/model/entity"
)

func TestUpdateAccountNodeTrafficSeparatesProtocolCounters(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HUI_DATA", root+string(os.PathSeparator))
	if err := InitSql(""); err != nil {
		t.Fatalf("initialize database: %v", err)
	}
	t.Cleanup(func() { _ = CloseSqliteDB() })

	username := "traffic-test"
	id, err := SaveAccount(entity.Account{Username: &username})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	if err := UpdateAccount([]int64{id}, map[string]interface{}{"download": 80, "upload": 20}); err != nil {
		t.Fatalf("seed legacy aggregate counters: %v", err)
	}
	if err := sqliteDB.Model(&entity.Config{}).Where("key = ?", "NODE_TRAFFIC_MIGRATION").Update("value", "pending").Error; err != nil {
		t.Fatalf("mark node traffic migration pending: %v", err)
	}
	if err := migrateNodeTrafficCounters(); err != nil {
		t.Fatalf("migrate node counters: %v", err)
	}

	account, err := GetAccount("id = ?", id)
	if err != nil {
		t.Fatalf("read account after migration: %v", err)
	}
	if *account.Download != 80 || *account.Upload != 20 || *account.Hysteria2Download != 0 || *account.Hysteria2Upload != 0 {
		t.Fatalf("migration misattributed legacy traffic: aggregate=%d/%d Hysteria2=%d/%d", *account.Download, *account.Upload, *account.Hysteria2Download, *account.Hysteria2Upload)
	}

	if err := UpdateAccountNodeTraffic(username, "hysteria2", 12, 3); err != nil {
		t.Fatalf("update Hysteria2 traffic: %v", err)
	}
	if err := UpdateAccountNodeTraffic(username, "vless", 6, 4); err != nil {
		t.Fatalf("update VLESS traffic: %v", err)
	}
	account, err = GetAccount("id = ?", id)
	if err != nil {
		t.Fatalf("read account after traffic updates: %v", err)
	}
	if *account.Download != 98 || *account.Upload != 27 {
		t.Fatalf("aggregate counters = %d/%d; want 98/27", *account.Download, *account.Upload)
	}
	if *account.Hysteria2Download != 12 || *account.Hysteria2Upload != 3 || *account.VlessDownload != 6 || *account.VlessUpload != 4 {
		t.Fatalf("node counters are incorrect: Hysteria2=%d/%d VLESS=%d/%d", *account.Hysteria2Download, *account.Hysteria2Upload, *account.VlessDownload, *account.VlessUpload)
	}
	if err := UpdateAccountNodeTraffic(username, "unknown", 1, 1); err == nil {
		t.Fatal("expected unknown node to be rejected")
	}
}
