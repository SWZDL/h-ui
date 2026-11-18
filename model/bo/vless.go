package bo

// VlessConfig describes the VLESS inbound and its local Xray management API.
// h-ui provisions account UUIDs through Xray and enforces account limits using
// Xray traffic and online-IP statistics.
type VlessConfig struct {
	Enabled         bool     `json:"enabled"`
	Address         string   `json:"address"`
	Port            int      `json:"port"`
	Network         string   `json:"network"`
	Security        string   `json:"security"`
	Remark          string   `json:"remark"`
	SNI             string   `json:"sni"`
	Fingerprint     string   `json:"fingerprint"`
	PublicKey       string   `json:"publicKey"`
	ShortID         string   `json:"shortId"`
	SpiderX         string   `json:"spiderX"`
	Flow            string   `json:"flow"`
	Path            string   `json:"path"`
	Host            string   `json:"host"`
	ServiceName     string   `json:"serviceName"`
	ALPN            []string `json:"alpn"`
	AllowInsecure   bool     `json:"allowInsecure"`
	XrayConfigPath  string   `json:"xrayConfigPath"`
	XrayServiceName string   `json:"xrayServiceName"`
	XrayAPIAddress  string   `json:"xrayApiAddress"`
	XrayInboundTag  string   `json:"xrayInboundTag"`
	XrayBinaryPath  string   `json:"xrayBinaryPath"`
}
