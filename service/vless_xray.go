package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"h-ui/dao"
	"h-ui/model/bo"
	"h-ui/model/entity"
	"h-ui/proxy"
)

var vlessSyncMutex sync.Mutex
var lastVlessSyncWarning time.Time

// Xray clients without an email cannot be billed, and they cannot be removed
// through the API either, so the service is restarted to apply the normalized
// config. The interval keeps that restart from looping.
const vlessClientCleanupInterval = 5 * time.Minute

var lastVlessClientCleanup time.Time

// InitVless prepares the local Xray API and brings managed users in sync with
// the account database. Runtime traffic and device enforcement is handled by
// CronHandleVless.
func InitVless() error {
	config, err := GetVlessConfig()
	if err != nil || !config.Enabled {
		return err
	}
	if err = proxy.ConfigureXrayAPI(config); err != nil {
		return err
	}
	CronHandleVless()
	return nil
}

func VlessIsEnabled() bool {
	config, err := GetVlessConfig()
	return err == nil && config.Enabled
}

// VlessOnline returns active unique source IPs per h-ui account, as reported by
// Xray's online-session statistics.
func VlessOnline() (map[string]int64, error) {
	result := map[string]int64{}
	config, err := GetVlessConfig()
	if err != nil || !config.Enabled {
		return result, err
	}
	online, err := proxy.NewXrayAPI(config).OnlineUsers()
	if err != nil {
		return nil, err
	}
	accounts, err := dao.ListAccount(nil, nil)
	if err != nil {
		return nil, err
	}
	for _, account := range accounts {
		email := vlessXrayEmail(account)
		if len(online[email]) > 0 {
			result[valueOrEmpty(account.Username)] = int64(len(online[email]))
		}
	}
	return result, nil
}

// CronHandleVless samples per-user Xray counters, persists their deltas, and
// reconciles Xray's authenticated-user list. Removing a user prevents new VLESS
// sessions when the account is expired, over quota, kicked, disabled, or at
// its concurrent-device cap.
func CronHandleVless() {
	if !vlessSyncMutex.TryLock() {
		return
	}
	defer vlessSyncMutex.Unlock()

	config, err := GetVlessConfig()
	if err != nil {
		warnVlessSync("load config", err)
		return
	}
	if !config.Enabled {
		return
	}
	api := proxy.NewXrayAPI(config)

	stats, err := api.QueryStats("user>>>"+proxy.ManagedXrayEmailPrefix, true)
	if err != nil {
		warnVlessSync("read traffic", err)
		return
	}
	accountByEmail := map[string]entity.Account{}
	accounts, err := dao.ListAccount(nil, nil)
	if err != nil {
		warnVlessSync("load accounts", err)
		return
	}
	for _, account := range accounts {
		accountByEmail[vlessXrayEmail(account)] = account
	}
	for _, stat := range stats {
		parts := strings.Split(stat.Name, ">>>")
		if len(parts) != 4 || parts[0] != "user" || parts[2] != "traffic" {
			continue
		}
		account, ok := accountByEmail[parts[1]]
		if !ok || account.Username == nil {
			continue
		}
		switch parts[3] {
		case "downlink":
			if stat.Value > 0 {
				if err := dao.UpdateAccountNodeTraffic(*account.Username, "vless", stat.Value, 0); err != nil {
					warnVlessSync("save download traffic", err)
				}
			}
		case "uplink":
			if stat.Value > 0 {
				if err := dao.UpdateAccountNodeTraffic(*account.Username, "vless", 0, stat.Value); err != nil {
					warnVlessSync("save upload traffic", err)
				}
			}
		}
	}

	// Reload after applying traffic deltas so quota checks include both
	// Hysteria2 traffic and the latest Xray sample.
	accounts, err = dao.ListAccount(nil, nil)
	if err != nil {
		warnVlessSync("reload accounts", err)
		return
	}
	online, err := api.OnlineUsers()
	if err != nil {
		warnVlessSync("read online devices", err)
		return
	}
	current, err := api.InboundUsers()
	if err != nil {
		warnVlessSync("read Xray inbound users", err)
		return
	}

	now := time.Now().UnixMilli()
	desired := make(map[string]proxy.XrayClient, len(accounts))
	for _, account := range accounts {
		if !vlessAccountAllowed(account, now) {
			continue
		}
		email := vlessXrayEmail(account)
		if int64(len(online[email])) >= valueOrZero(account.DeviceNo) {
			continue
		}
		desired[email] = proxy.XrayClient{
			Email: email,
			UUID:  valueOrEmpty(account.VlessUUID),
			Flow:  config.Flow,
		}
	}

	var remove []string
	for email, user := range current {
		if !strings.HasPrefix(email, proxy.ManagedXrayEmailPrefix) {
			continue
		}
		want, ok := desired[email]
		if !ok || want.UUID != user.UUID || want.Flow != user.Flow {
			remove = append(remove, email)
		} else {
			delete(desired, email)
		}
	}
	if len(remove) > 0 {
		if err := api.RemoveUsers(remove); err != nil {
			warnVlessSync("remove ineligible Xray users", err)
			return
		}
	}
	add := make([]proxy.XrayClient, 0, len(desired))
	for _, user := range desired {
		add = append(add, user)
	}
	if len(add) > 0 {
		if err := api.AddUsers(add); err != nil {
			warnVlessSync("add eligible Xray users", err)
			return
		}
	}

	// Persist the billable client list so a restart cannot resurrect a client
	// that is not billed, and drop live clients that have no h-ui email: the
	// traffic query is keyed by email, so those sessions would stay free.
	if _, err := proxy.SyncInboundClients(config, vlessInboundClients(accounts, config)); err != nil {
		warnVlessSync("persist inbound clients", err)
	}
	anonymous := 0
	for email := range current {
		if !strings.HasPrefix(email, proxy.ManagedXrayEmailPrefix) {
			anonymous++
		}
	}
	if anonymous > 0 && time.Since(lastVlessClientCleanup) >= vlessClientCleanupInterval {
		lastVlessClientCleanup = time.Now()
		logrus.Warnf("VLESS/Xray found %d client(s) without an h-ui email; restarting Xray to stop unbilled usage", anonymous)
		if err := proxy.ControlXrayService(config, "restart"); err != nil {
			warnVlessSync("restart Xray service to drop unbilled clients", err)
		}
	}
}

// vlessInboundClients lists the accounts allowed to connect right now, in the
// shape the Xray config stores them, so every static client stays billable.
func vlessInboundClients(accounts []entity.Account, config bo.VlessConfig) []proxy.XrayInboundClient {
	now := time.Now().UnixMilli()
	clients := make([]proxy.XrayInboundClient, 0, len(accounts))
	for _, account := range accounts {
		if !vlessAccountAllowed(account, now) {
			continue
		}
		clients = append(clients, proxy.XrayInboundClient{
			UUID:  valueOrEmpty(account.VlessUUID),
			Email: vlessXrayEmail(account),
			Flow:  config.Flow,
		})
	}
	return clients
}

func vlessXrayEmail(account entity.Account) string {
	if account.Id == nil {
		return ""
	}
	return fmt.Sprintf("%s%d", proxy.ManagedXrayEmailPrefix, *account.Id)
}

func vlessAccountAllowed(account entity.Account, now int64) bool {
	if account.Id == nil || account.Deleted == nil || *account.Deleted != 0 || account.VlessUUID == nil || *account.VlessUUID == "" {
		return false
	}
	if account.Quota == nil || account.ExpireTime == nil || account.KickUtilTime == nil || account.DeviceNo == nil {
		return false
	}
	if *account.ExpireTime <= now || *account.KickUtilTime >= now || *account.DeviceNo <= 0 {
		return false
	}
	usage := valueOrZero(account.Download) + valueOrZero(account.Upload)
	return *account.Quota < 0 || *account.Quota > usage
}

func warnVlessSync(operation string, err error) {
	if time.Since(lastVlessSyncWarning) < 30*time.Second {
		return
	}
	lastVlessSyncWarning = time.Now()
	logrus.Warnf("VLESS/Xray %s failed: %v", operation, err)
}

// RemoveManagedVlessUsers drops only accounts owned by h-ui, leaving any
// separately configured Xray users untouched.
func RemoveManagedVlessUsers(config bo.VlessConfig) error {
	api := proxy.NewXrayAPI(config)
	users, err := api.InboundUsers()
	if err != nil {
		return err
	}
	var emails []string
	for email := range users {
		if strings.HasPrefix(email, proxy.ManagedXrayEmailPrefix) {
			emails = append(emails, email)
		}
	}
	return api.RemoveUsers(emails)
}
