package vo

type SystemMonitorVo struct {
	Hostname         string  `json:"hostname"`
	IP               string  `json:"ip"`
	HUIVersion       string  `json:"huiVersion"`
	CpuPercent       float64 `json:"cpuPercent"`
	MemPercent       float64 `json:"memPercent"`
	DiskPercent      float64 `json:"diskPercent"`
	Hysteria2Running bool    `json:"hysteria2Running"`
	VlessRunning     bool    `json:"vlessRunning"`
}

type Hysteria2MonitorVo struct {
	UserTotal   int64  `json:"userTotal"`   // 在线用户数
	DeviceTotal int64  `json:"deviceTotal"` // 在线设备数
	Version     string `json:"version"`     // 版本
	Running     bool   `json:"running"`     // 运行状态
}
