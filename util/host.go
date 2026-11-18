package util

import (
	"net"
	"os"
	"strings"
	"time"
)

// HostName returns the machine name shown in the panel header.
func HostName() string {
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(name)
}

// PrimaryIP returns the address the host uses for outbound traffic. The UDP
// dial only asks the kernel for a route and never sends a packet.
func PrimaryIP() string {
	conn, err := net.DialTimeout("udp", "223.5.5.5:53", time.Second)
	if err == nil {
		defer conn.Close()
		if address, ok := conn.LocalAddr().(*net.UDPAddr); ok && address.IP != nil && !address.IP.IsUnspecified() {
			return address.IP.String()
		}
	}
	addresses, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, address := range addresses {
		network, ok := address.(*net.IPNet)
		if !ok || network.IP.IsLoopback() || network.IP.IsLinkLocalUnicast() {
			continue
		}
		if ipv4 := network.IP.To4(); ipv4 != nil {
			return ipv4.String()
		}
	}
	return ""
}
