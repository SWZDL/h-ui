package service

import (
	"errors"
	"fmt"
	"h-ui/model/constant"
	"h-ui/model/vo"
	"h-ui/proxy"
	"h-ui/util"
	"regexp"
	"strings"
	"sync"
	"time"
)

// The dashboard polls the monitor endpoints, and every status probe spawns
// systemctl or the proxy binary; a short cache keeps that cost bounded.
const serviceStatusTTL = 5 * time.Second

var (
	serviceStatusMutex sync.Mutex
	serviceStatusAt    time.Time
	serviceStatus      struct {
		hysteria2 bool
		vless     bool
	}
)

func vlessServiceRunning() bool {
	config, err := GetVlessConfig()
	if err != nil || !config.Enabled {
		return false
	}
	status, err := proxy.XrayServiceStatusFor(config)
	return err == nil && status.Running
}

// runningServices reports which proxy services are currently usable, so the
// panel only offers subscriptions and node links that actually work.
func runningServices() (hysteria2 bool, vless bool) {
	serviceStatusMutex.Lock()
	defer serviceStatusMutex.Unlock()
	if !serviceStatusAt.IsZero() && time.Since(serviceStatusAt) < serviceStatusTTL {
		return serviceStatus.hysteria2, serviceStatus.vless
	}
	hysteria2 = Hysteria2IsRunning()
	vless = vlessServiceRunning()
	serviceStatus.hysteria2, serviceStatus.vless = hysteria2, vless
	serviceStatusAt = time.Now()
	return hysteria2, vless
}

func MonitorSystem() (vo.SystemMonitorVo, error) {
	cpuPercent, err := util.GetCpuPercent()
	if err != nil {
		return vo.SystemMonitorVo{}, errors.New("cpu query failed")
	}
	memPercent, err := util.GetMemPercent()
	if err != nil {
		return vo.SystemMonitorVo{}, errors.New("mem query failed")
	}
	diskPercent, err := util.GetDiskPercent()
	if err != nil {
		return vo.SystemMonitorVo{}, errors.New("disk query failed")
	}
	hysteria2Running, vlessRunning := runningServices()
	return vo.SystemMonitorVo{
		Hostname:         util.HostName(),
		IP:               util.PrimaryIP(),
		HUIVersion:       constant.Version,
		CpuPercent:       cpuPercent,
		MemPercent:       memPercent,
		DiskPercent:      diskPercent,
		Hysteria2Running: hysteria2Running,
		VlessRunning:     vlessRunning,
	}, nil
}

func MonitorHysteria2() (vo.Hysteria2MonitorVo, error) {
	var hysteria2MonitorVo vo.Hysteria2MonitorVo
	onlineUsers, err := Hysteria2Online()
	if err != nil {
		return hysteria2MonitorVo, err
	}

	if len(onlineUsers) > 0 {
		hysteria2MonitorVo.UserTotal = int64(len(onlineUsers))
		var deviceTotal int64 = 0
		for _, value := range onlineUsers {
			deviceTotal += value
		}
		hysteria2MonitorVo.DeviceTotal = deviceTotal
	}

	hysteria2MonitorVo.Version = "-"
	content, err := util.ExecShell(fmt.Sprintf("%s version", util.GetHysteria2BinPath()))
	if err == nil {
		pattern := `v\d+\.\d+\.\d+`
		re := regexp.MustCompile(pattern)
		matches := re.FindAllString(strings.TrimSpace(content), -1)
		if len(matches) > 0 {
			hysteria2MonitorVo.Version = matches[0]
		}
	}

	running := Hysteria2IsRunning()
	hysteria2MonitorVo.Running = running
	return hysteria2MonitorVo, nil
}
