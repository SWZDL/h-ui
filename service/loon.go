package service

import (
	"fmt"
	"strconv"
	"strings"

	"h-ui/model/bo"
)

// Loon subscriptions are plain text node lines grouped in a [Proxy] section.
// Loon chooses its TLS ClientHello fingerprint from "tls-profile"; only the
// modern profiles (chrome147, safari-ios-26) advertise X25519MLKEM768, which a
// REALITY server built on Xray >= v26.9.9 requires before it authenticates a
// client. The older chrome/safari-ios18 profiles do not.
const (
	loonProxySection        = "[Proxy]"
	loonTLSProfileChrome    = "chrome147"
	loonTLSProfileSafariIOS = "safari-ios-26"
)

// loonTLSProfiles lists the values Loon documents for "tls-profile".
var loonTLSProfiles = map[string]bool{
	"global":        true,
	"default":       true,
	"safari-ios18":  true,
	"safari-ios-26": true,
	"chrome":        true,
	"chrome147":     true,
}

// defaultLoonTLSProfile maps the VLESS fingerprint onto the equivalent Loon
// profile, keeping the MLKEM capable variant.
func defaultLoonTLSProfile(fingerprint string) string {
	switch strings.ToLower(strings.TrimSpace(fingerprint)) {
	case "safari", "ios", "safari-ios", "safari-ios18", "safari-ios-26":
		return loonTLSProfileSafariIOS
	default:
		return loonTLSProfileChrome
	}
}

// loonTLSProfile returns the configured Loon profile or derives one from the
// VLESS fingerprint.
func loonTLSProfile(config bo.VlessConfig) string {
	if profile := strings.ToLower(strings.TrimSpace(config.LoonTLSProfile)); profile != "" {
		return profile
	}
	return defaultLoonTLSProfile(config.Fingerprint)
}

func validateLoonTLSProfile(profile string) error {
	profile = strings.ToLower(strings.TrimSpace(profile))
	if profile == "" || loonTLSProfiles[profile] {
		return nil
	}
	return fmt.Errorf("unsupported Loon TLS profile %q", profile)
}

// loonName sanitises a node name: Loon reads "name = node", so an "=" or a
// newline in the name would break the subscription.
func loonName(name string) string {
	name = strings.NewReplacer("\r", " ", "\n", " ", "=", "-").Replace(name)
	name = strings.Join(strings.Fields(name), " ")
	if name == "" {
		return "h-ui"
	}
	return name
}

// loonQuote wraps a parameter value that may contain commas or spaces.
func loonQuote(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, "") + `"`
}

// loonSubscription renders node lines as a Loon subscription.
func loonSubscription(nodes []string) string {
	lines := make([]string, 0, len(nodes))
	for _, node := range nodes {
		if node = strings.TrimSpace(node); node != "" {
			lines = append(lines, node)
		}
	}
	return loonProxySection + "\n" + strings.Join(lines, "\n") + "\n"
}

// mergeLoonSubscriptions combines Loon subscriptions into a single [Proxy]
// section, mirroring mergeClashSubscriptions.
func mergeLoonSubscriptions(sections ...string) string {
	lines := make([]string, 0, len(sections))
	for _, section := range sections {
		for _, line := range strings.Split(section, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || line == loonProxySection || strings.HasPrefix(line, "#") {
				continue
			}
			lines = append(lines, line)
		}
	}
	return loonSubscription(lines)
}

func buildLoonVlessNode(config bo.VlessConfig, name string, uuid string) (string, error) {
	network := config.Network
	if network == "" {
		network = "tcp"
	}
	if network != "tcp" && network != "ws" {
		return "", fmt.Errorf("Loon subscriptions do not support the %q transport", network)
	}

	address := strings.Trim(strings.TrimSpace(config.Address), "[]")
	params := []string{
		"VLESS",
		address,
		strconv.Itoa(config.Port),
		loonQuote(uuid),
		"transport=" + network,
	}
	if flow := strings.TrimSpace(config.Flow); flow != "" {
		params = append(params, "flow="+flow)
	}
	if network == "ws" {
		path := config.Path
		if path == "" {
			path = "/"
		}
		params = append(params, "path="+path)
		if host := strings.TrimSpace(config.Host); host != "" {
			params = append(params, "host="+host)
		}
	}
	if config.Security == "none" {
		params = append(params, "over-tls=false")
	} else {
		sni := strings.TrimSpace(config.SNI)
		if sni == "" {
			sni = address
		}
		params = append(params, "over-tls=true", "sni="+sni)
		if config.Security == "reality" {
			params = append(params, "public-key="+loonQuote(config.PublicKey), "short-id="+config.ShortID)
		}
		params = append(params, "tls-profile="+loonTLSProfile(config))
		if len(config.ALPN) > 0 {
			params = append(params, "alpn="+loonQuote(strings.Join(config.ALPN, ",")))
		}
		if config.Security == "tls" && config.AllowInsecure {
			params = append(params, "skip-cert-verify=true")
		}
	}
	params = append(params, "udp=true", "block-quic=false")
	return loonName(name) + " = " + strings.Join(params, ","), nil
}

// loonPortHopping converts mihomo's "20000-30000" port range notation into the
// "20000:30000" form Loon expects for "server-ports".
func loonPortHopping(ports string) string {
	ports = strings.TrimSpace(ports)
	if ports == "" {
		return ""
	}
	parts := strings.Split(ports, ",")
	for index, part := range parts {
		parts[index] = strings.Replace(strings.TrimSpace(part), "-", ":", 1)
	}
	return strings.Join(parts, ",")
}

func buildLoonHysteria2Node(node bo.Hysteria2) string {
	params := []string{
		"Hysteria2",
		node.Server,
		node.Port,
		loonQuote(node.Password),
	}
	if sni := strings.TrimSpace(node.Sni); sni != "" {
		params = append(params, "sni="+sni)
	}
	params = append(params, "skip-cert-verify="+strconv.FormatBool(node.SkipCertVerify))
	if node.Obfs == "salamander" && node.ObfsPassword != "" {
		params = append(params, "salamander-password="+loonQuote(node.ObfsPassword))
	}
	if hopping := loonPortHopping(node.Ports); hopping != "" {
		params = append(params, "server-ports="+loonQuote(hopping))
	}
	params = append(params, "udp=true")
	return loonName(node.Name) + " = " + strings.Join(params, ",")
}
