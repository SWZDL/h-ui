package service

import (
	"errors"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"h-ui/model/vo"
	"h-ui/proxy"
	"h-ui/util"
)

func VlessXrayServiceStatus() (proxy.XrayServiceStatus, error) {
	config, err := GetVlessConfig()
	if err != nil {
		return proxy.XrayServiceStatus{}, err
	}
	return proxy.XrayServiceStatusFor(config)
}

func ControlVlessXrayService(action string) error {
	config, err := GetVlessConfig()
	if err != nil {
		return err
	}
	return proxy.ControlXrayService(config, action)
}

func ListXrayReleaseVersions() ([]string, error) {
	assetName, err := proxy.XrayArchiveName(runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return nil, err
	}
	releases, err := util.ListRelease("XTLS", "Xray-core")
	if err != nil {
		return nil, err
	}
	versions := make([]string, 0, len(releases))
	for _, release := range releases {
		version := strings.TrimSpace(release.GetTagName())
		if version == "" || release.GetDraft() {
			continue
		}
		for _, asset := range release.Assets {
			if asset.GetName() == assetName {
				versions = append(versions, version)
				break
			}
		}
	}
	return versions, nil
}

func UpgradeVlessXray(version string) error {
	config, err := GetVlessConfig()
	if err != nil {
		return err
	}
	if strings.TrimSpace(version) == "" {
		return errors.New("Xray version is required")
	}
	return proxy.UpgradeXray(config, version)
}

// xrayUnitPattern keeps the configured unit name from reaching the journal
// command line as anything but a service name.
var xrayUnitPattern = regexp.MustCompile(`^[A-Za-z0-9_.@:-]+$`)

// Xray logs to stdout, so the systemd journal is the only source that covers
// every inbound, not just the one h-ui manages.
var xrayLogLinePattern = regexp.MustCompile(`^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*(?:\[([A-Za-z]+)\])?\s*(.*)$`)

// VlessLogs returns the most recent Xray log lines.
func VlessLogs(numLine int) ([]vo.LogXrayVo, error) {
	if numLine <= 0 {
		numLine = 100
	}
	config, err := GetVlessConfig()
	if err != nil {
		return nil, err
	}
	unit := strings.TrimSpace(config.XrayServiceName)
	if !xrayUnitPattern.MatchString(unit) {
		return nil, errors.New("invalid Xray systemd service name")
	}
	if _, err := exec.LookPath("journalctl"); err != nil {
		return nil, errors.New("journalctl is not available")
	}
	output, err := util.ExecCommand("journalctl", "-u", unit, "-n", strconv.Itoa(numLine), "-o", "cat", "--no-pager")
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimRight(output, "\n"), "\n")
	logs := make([]vo.LogXrayVo, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "-- ") {
			continue
		}
		logs = append(logs, parseXrayLogLine(line))
	}
	return logs, nil
}

func parseXrayLogLine(line string) vo.LogXrayVo {
	if match := xrayLogLinePattern.FindStringSubmatch(line); match != nil {
		level := strings.ToLower(match[2])
		if level == "" {
			level = "info"
		}
		return vo.LogXrayVo{Time: match[1], Level: level, Msg: match[3]}
	}
	return vo.LogXrayVo{Level: "info", Msg: line}
}
