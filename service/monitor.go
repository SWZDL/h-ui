package service

import (
	"errors"
	"fmt"
	"h-ui/dao"
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
// systemctl; a short cache keeps that cost bounded.
const serviceStatusTTL = 5 * time.Second

type proxyServiceState struct {
	hysteria2Enabled bool
	hysteria2Running bool
	vlessEnabled     bool
	vlessRunning     bool
	xrayVersion      string
}

var (
	serviceStatusMutex sync.Mutex
	serviceStatusAt    time.Time
	serviceStatus      proxyServiceState
)

// hysteria2ServiceEnabled reports whether the panel is configured to run
// Hysteria2 at all: a disabled service has no links to offer.
func hysteria2ServiceEnabled() bool {
	config, err := dao.GetConfig("key = ?", constant.Hysteria2Enable)
	return err == nil && config.Value != nil && *config.Value == "1"
}

func xrayServiceState() (enabled bool, running bool, version string) {
	config, err := GetVlessConfig()
	if err != nil || !config.Enabled {
		return false, false, ""
	}
	status, err := proxy.XrayServiceStatusFor(config)
	if err != nil {
		return true, false, ""
	}
	return true, status.Running, status.Version
}

// proxyServices reports which proxy services are enabled and running, so the
// panel only advertises links that actually work.
func proxyServices() proxyServiceState {
	serviceStatusMutex.Lock()
	defer serviceStatusMutex.Unlock()
	if !serviceStatusAt.IsZero() && time.Since(serviceStatusAt) < serviceStatusTTL {
		return serviceStatus
	}
	state := proxyServiceState{hysteria2Enabled: hysteria2ServiceEnabled()}
	if state.hysteria2Enabled {
		state.hysteria2Running = Hysteria2IsRunning()
	}
	state.vlessEnabled, state.vlessRunning, state.xrayVersion = xrayServiceState()
	serviceStatus, serviceStatusAt = state, time.Now()
	return state
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
	services := proxyServices()
	return vo.SystemMonitorVo{
		Hostname:         util.HostName(),
		IP:               util.PrimaryIP(),
		HUIVersion:       constant.Version,
		CpuPercent:       cpuPercent,
		MemPercent:       memPercent,
		DiskPercent:      diskPercent,
		Hysteria2Enabled: services.hysteria2Enabled,
		Hysteria2Running: services.hysteria2Running,
		VlessEnabled:     services.vlessEnabled,
		VlessRunning:     services.vlessRunning,
		XrayVersion:      services.xrayVersion,
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
