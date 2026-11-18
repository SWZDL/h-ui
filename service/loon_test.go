package service

import (
	"strings"
	"testing"

	"h-ui/model/bo"
	"h-ui/model/constant"
)

func TestLoonVlessRealityNode(t *testing.T) {
	config := bo.VlessConfig{
		Address:     "cdn.example.com",
		Port:        443,
		Network:     "tcp",
		Security:    "reality",
		Remark:      "edge",
		SNI:         "www.cloudflare.com",
		Fingerprint: "chrome",
		PublicKey:   "public-key",
		ShortID:     "abcd1234",
		Flow:        "xtls-rprx-vision",
	}
	node, err := buildLoonVlessNode(config, vlessNodeName(config, "alice", ""), "11111111-1111-4111-8111-111111111111")
	if err != nil {
		t.Fatalf("build Loon VLESS node: %v", err)
	}
	want := `edge - alice = VLESS,cdn.example.com,443,"11111111-1111-4111-8111-111111111111",transport=tcp,` +
		`flow=xtls-rprx-vision,over-tls=true,sni=www.cloudflare.com,public-key="public-key",short-id=abcd1234,` +
		`tls-profile=chrome147,udp=true,block-quic=false`
	if node != want {
		t.Fatalf("unexpected Loon node:\n got %s\nwant %s", node, want)
	}
}

func TestLoonVlessTLSWebsocketNode(t *testing.T) {
	config := bo.VlessConfig{
		Address:     "vless.example.com",
		Port:        8443,
		Network:     "ws",
		Security:    "tls",
		SNI:         "tls.example.com",
		Fingerprint: "safari",
		Path:        "/tunnel",
		Host:        "ws.example.com",
		ALPN:        []string{"h2", "http/1.1"},
	}
	node, err := buildLoonVlessNode(config, "ws node", "uuid-value")
	if err != nil {
		t.Fatalf("build Loon VLESS node: %v", err)
	}
	want := `ws node = VLESS,vless.example.com,8443,"uuid-value",transport=ws,path=/tunnel,host=ws.example.com,` +
		`over-tls=true,sni=tls.example.com,tls-profile=safari-ios-26,alpn="h2,http/1.1",udp=true,block-quic=false`
	if node != want {
		t.Fatalf("unexpected Loon node:\n got %s\nwant %s", node, want)
	}
	if strings.Contains(node, "public-key") {
		t.Fatalf("TLS node must not carry Reality keys: %s", node)
	}
}

func TestLoonVlessNodeKeepsSkipCertVerifyForTLS(t *testing.T) {
	config := bo.VlessConfig{
		Address:       "vless.example.com",
		Port:          443,
		Network:       "tcp",
		Security:      "tls",
		SNI:           "vless.example.com",
		AllowInsecure: true,
	}
	node, err := buildLoonVlessNode(config, "node", "uuid")
	if err != nil {
		t.Fatalf("build Loon VLESS node: %v", err)
	}
	if !strings.Contains(node, "skip-cert-verify=true") {
		t.Fatalf("insecure TLS node lost skip-cert-verify: %s", node)
	}
}

func TestLoonVlessNodeRejectsUnsupportedTransport(t *testing.T) {
	config := bo.VlessConfig{
		Address:  "vless.example.com",
		Port:     443,
		Network:  "grpc",
		Security: "tls",
	}
	if _, err := buildLoonVlessNode(config, "node", "uuid"); err == nil {
		t.Fatal("expected gRPC transport to be rejected for Loon")
	}
}

func TestLoonTLSProfileSelection(t *testing.T) {
	tests := []struct {
		name        string
		fingerprint string
		configured  string
		want        string
	}{
		{name: "chrome-default", fingerprint: "chrome", want: "chrome147"},
		{name: "empty-fingerprint", fingerprint: "", want: "chrome147"},
		{name: "firefox", fingerprint: "firefox", want: "chrome147"},
		{name: "safari", fingerprint: "safari", want: "safari-ios-26"},
		{name: "ios", fingerprint: "ios", want: "safari-ios-26"},
		{name: "configured-wins", fingerprint: "safari", configured: "chrome", want: "chrome"},
		{name: "configured-legacy", fingerprint: "chrome", configured: "safari-ios18", want: "safari-ios18"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := loonTLSProfile(bo.VlessConfig{Fingerprint: test.fingerprint, LoonTLSProfile: test.configured})
			if got != test.want {
				t.Fatalf("loonTLSProfile(%q, %q) = %q, want %q", test.fingerprint, test.configured, got, test.want)
			}
		})
	}

	for _, profile := range []string{"global", "default", "safari-ios18", "safari-ios-26", "chrome", "chrome147", " CHROME "} {
		if err := validateLoonTLSProfile(profile); err != nil {
			t.Errorf("profile %q rejected: %v", profile, err)
		}
	}
	if err := validateLoonTLSProfile("chrome-147"); err == nil {
		t.Fatal("expected an unsupported Loon TLS profile to be rejected")
	}
	config := bo.VlessConfig{
		Enabled: true, Address: "vless.example.com", Port: 443, Network: "tcp", Security: "tls",
		LoonTLSProfile: "chrome-147",
	}
	if err := validateVlessConfig(config); err == nil {
		t.Fatal("expected validateVlessConfig to reject an unsupported Loon TLS profile")
	}
}

func TestLoonNameAndHoppingHelpers(t *testing.T) {
	if got := loonName("  edge\nnode = x  "); got != "edge node - x" {
		t.Fatalf("loonName sanitised to %q", got)
	}
	if got := loonName("   "); got != "h-ui" {
		t.Fatalf("empty loonName = %q", got)
	}
	if got := loonPortHopping("20000-30000"); got != "20000:30000" {
		t.Fatalf("loonPortHopping = %q", got)
	}
	if got := loonPortHopping("1000,20000-30000"); got != "1000,20000:30000" {
		t.Fatalf("loonPortHopping = %q", got)
	}
	if got := loonPortHopping("  "); got != "" {
		t.Fatalf("empty loonPortHopping = %q", got)
	}
}

func TestLoonHysteria2Node(t *testing.T) {
	node := buildLoonHysteria2Node(bo.Hysteria2{
		Name:         "hy2",
		Server:       "hy2.example.com",
		Port:         "443",
		Password:     "secret",
		Sni:          "hy2.example.com",
		Obfs:         "salamander",
		ObfsPassword: "obfs",
		Ports:        "20000-30000",
	})
	want := `hy2 = Hysteria2,hy2.example.com,443,"secret",sni=hy2.example.com,skip-cert-verify=false,` +
		`salamander-password="obfs",server-ports="20000:30000",udp=true`
	if node != want {
		t.Fatalf("unexpected Loon Hysteria2 node:\n got %s\nwant %s", node, want)
	}
}

func TestMergeLoonSubscriptionsKeepsSingleSection(t *testing.T) {
	merged := mergeLoonSubscriptions(
		loonSubscription([]string{`hy2 = Hysteria2,hy2.example.com,443,"secret",udp=true`}),
		loonSubscription([]string{`vless = VLESS,vless.example.com,443,"uuid",transport=tcp,udp=true`}),
	)
	if strings.Count(merged, loonProxySection) != 1 {
		t.Fatalf("merged subscription must contain one %s section: %q", loonProxySection, merged)
	}
	if !strings.Contains(merged, "Hysteria2,") || !strings.Contains(merged, "VLESS,") {
		t.Fatalf("merged subscription lost a protocol: %q", merged)
	}
	if strings.Contains(merged, "\n\n") {
		t.Fatalf("merged subscription contains blank lines: %q", merged)
	}
}

func TestVlessSubscribeForLoonReturnsLoonSection(t *testing.T) {
	setupProxySubscriptionTest(t)
	userInfo, content, err := VlessSubscribe("alice.password", constant.Loon)
	if err != nil {
		t.Fatalf("build Loon VLESS subscription: %v", err)
	}
	if !strings.HasPrefix(userInfo, "upload=") {
		t.Fatalf("unexpected user info: %q", userInfo)
	}
	if !strings.HasPrefix(content, loonProxySection+"\n") {
		t.Fatalf("Loon subscription must start with %s: %q", loonProxySection, content)
	}
	if strings.Contains(content, "proxies:") {
		t.Fatalf("Loon subscription must not contain Clash YAML: %q", content)
	}
	for _, expected := range []string{
		"VLESS,vless.example.com,443,",
		"flow=xtls-rprx-vision",
		"over-tls=true",
		"sni=vless.example.com",
		`public-key="public-key"`,
		"short-id=1234",
		"tls-profile=chrome147",
	} {
		if !strings.Contains(content, expected) {
			t.Errorf("Loon subscription missing %q:\n%s", expected, content)
		}
	}
}

func TestLoonSubscriptionIncludesBothRunningProtocols(t *testing.T) {
	setupProxySubscriptionTest(t)
	_, content, err := proxySubscribeForRunningServices("alice.password", constant.Loon, "panel.example.com:8099", true, true)
	if err != nil {
		t.Fatalf("build combined Loon subscription: %v", err)
	}
	if strings.Count(content, loonProxySection) != 1 {
		t.Fatalf("expected one %s section: %q", loonProxySection, content)
	}
	if !strings.Contains(content, "Hysteria2,") || !strings.Contains(content, "VLESS,") {
		t.Fatalf("combined Loon subscription missing a protocol: %q", content)
	}
}
