package proxy

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"h-ui/model/bo"
	"h-ui/util"
)

var xrayVersionPattern = regexp.MustCompile(`^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$`)
var systemdUnitPattern = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.@:-]*$`)

type XrayServiceStatus struct {
	State   string `json:"state"`
	Running bool   `json:"running"`
	Version string `json:"version"`
}

func XrayArchiveName(goos, goarch string) (string, error) {
	if goos != "linux" {
		return "", errors.New("Xray upgrades are supported on Linux only")
	}
	architecture := map[string]string{
		"amd64": "64",
		"386":   "32",
		"arm64": "arm64-v8a",
		"arm":   "arm32-v7a",
	}[goarch]
	if architecture == "" {
		return "", fmt.Errorf("Xray upgrades are not supported on Linux/%s", goarch)
	}
	return fmt.Sprintf("Xray-linux-%s.zip", architecture), nil
}

func XrayServiceStatusFor(config bo.VlessConfig) (XrayServiceStatus, error) {
	unit := strings.TrimSpace(config.XrayServiceName)
	if !systemdUnitPattern.MatchString(unit) {
		return XrayServiceStatus{}, errors.New("invalid Xray systemd service name")
	}
	if runtime.GOOS != "linux" {
		return XrayServiceStatus{}, errors.New("Xray service management requires Linux and systemd")
	}
	output, err := exec.Command("systemctl", "show", "--property=ActiveState", "--value", unit).CombinedOutput()
	if err != nil {
		return XrayServiceStatus{}, fmt.Errorf("read Xray service status: %w: %s", err, strings.TrimSpace(string(output)))
	}
	state := strings.TrimSpace(string(output))
	if state == "" {
		state = "unknown"
	}
	status := XrayServiceStatus{State: state, Running: state == "active"}
	versionOutput, versionErr := runXrayCommand(config.XrayBinaryPath, "version")
	if versionErr == nil {
		status.Version = ShortXrayVersion(string(versionOutput))
	}
	return status, nil
}

// xrayVersionNumber finds the version number in a banner such as
// "Xray 26.11.9 (Xray, Penetrates Everything.) 676eaf6 (go1.27.3 linux/amd64)".
var xrayVersionNumber = regexp.MustCompile(`\bv?(\d+\.\d+\.\d+)\b`)

// ShortXrayVersion reduces the Xray banner to "v26.11.9" for display.
func ShortXrayVersion(banner string) string {
	if match := xrayVersionNumber.FindStringSubmatch(banner); len(match) == 2 {
		return "v" + match[1]
	}
	version := strings.TrimSpace(banner)
	if firstLine, _, found := strings.Cut(version, "\n"); found {
		version = firstLine
	}
	return strings.TrimSpace(version)
}

func ControlXrayService(config bo.VlessConfig, action string) error {
	if action != "start" && action != "stop" && action != "restart" {
		return errors.New("unsupported Xray service action")
	}
	unit := strings.TrimSpace(config.XrayServiceName)
	if !systemdUnitPattern.MatchString(unit) {
		return errors.New("invalid Xray systemd service name")
	}
	if runtime.GOOS != "linux" {
		return errors.New("Xray service management requires Linux and systemd")
	}
	output, err := exec.Command("systemctl", action, unit).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s Xray service: %w: %s", action, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func UpgradeXray(config bo.VlessConfig, version string) error {
	version = strings.TrimSpace(version)
	if !xrayVersionPattern.MatchString(version) {
		return errors.New("invalid Xray version")
	}
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}
	if runtime.GOOS != "linux" {
		return errors.New("Xray upgrades are supported on Linux only")
	}
	unit := strings.TrimSpace(config.XrayServiceName)
	if !systemdUnitPattern.MatchString(unit) {
		return errors.New("invalid Xray systemd service name")
	}
	binaryPath := strings.TrimSpace(config.XrayBinaryPath)
	if binaryPath == "" {
		return errors.New("Xray binary path is required")
	}
	binaryPath, err := filepath.Abs(binaryPath)
	if err != nil {
		return err
	}

	statusOutput, err := exec.Command("systemctl", "show", "--property=ActiveState", "--value", unit).CombinedOutput()
	if err != nil {
		return fmt.Errorf("read Xray service status: %w: %s", err, strings.TrimSpace(string(statusOutput)))
	}
	wasRunning := strings.TrimSpace(string(statusOutput)) == "active"
	stopped := false
	restartOldService := func(cause error) error {
		if !stopped {
			return cause
		}
		if restartErr := ControlXrayService(config, "start"); restartErr != nil {
			return fmt.Errorf("%w; could not restart the previous Xray service: %v", cause, restartErr)
		}
		stopped = false
		return cause
	}

	assetName, err := XrayArchiveName(runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return restartOldService(err)
	}
	assetURL, err := util.GetReleaseAssetURL("XTLS", "Xray-core", version, assetName)
	if err != nil {
		return restartOldService(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, assetURL, nil)
	if err != nil {
		return restartOldService(err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return restartOldService(fmt.Errorf("download Xray release: %w", err))
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return restartOldService(fmt.Errorf("download Xray release: HTTP %s", response.Status))
	}
	archiveFile, err := os.CreateTemp("", "h-ui-xray-*.zip")
	if err != nil {
		return restartOldService(err)
	}
	archivePath := archiveFile.Name()
	defer os.Remove(archivePath)
	if _, err = io.Copy(archiveFile, response.Body); err != nil {
		_ = archiveFile.Close()
		return restartOldService(fmt.Errorf("save Xray archive: %w", err))
	}
	if err = archiveFile.Close(); err != nil {
		return restartOldService(err)
	}
	archive, err := zip.OpenReader(archivePath)
	if err != nil {
		return restartOldService(fmt.Errorf("open Xray archive: %w", err))
	}
	defer archive.Close()
	var binary *zip.File
	for _, file := range archive.File {
		if file.Name == "xray" && !file.FileInfo().IsDir() {
			binary = file
			break
		}
	}
	if binary == nil {
		return restartOldService(errors.New("Xray release archive does not contain the xray binary"))
	}

	tempFile, err := os.CreateTemp(filepath.Dir(binaryPath), ".h-ui-xray-update-*")
	if err != nil {
		return restartOldService(err)
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath)
	archiveBinary, err := binary.Open()
	if err != nil {
		_ = tempFile.Close()
		return restartOldService(err)
	}
	_, copyErr := io.Copy(tempFile, archiveBinary)
	closeArchiveErr := archiveBinary.Close()
	if copyErr == nil {
		copyErr = closeArchiveErr
	}
	if copyErr == nil {
		copyErr = tempFile.Chmod(0755)
	}
	if closeErr := tempFile.Close(); copyErr == nil {
		copyErr = closeErr
	}
	if copyErr != nil {
		return restartOldService(fmt.Errorf("extract Xray binary: %w", copyErr))
	}
	if _, err = runXrayCommand(tempPath, "version"); err != nil {
		return restartOldService(fmt.Errorf("validate downloaded Xray binary: %w", err))
	}

	var oldInfo os.FileInfo
	if oldInfo, err = os.Stat(binaryPath); err != nil && !os.IsNotExist(err) {
		return restartOldService(fmt.Errorf("inspect existing Xray binary: %w", err))
	}
	if oldInfo != nil && !oldInfo.Mode().IsRegular() {
		return restartOldService(errors.New("Xray binary path is not a regular file"))
	}
	if wasRunning {
		if err = ControlXrayService(config, "stop"); err != nil {
			return err
		}
		stopped = true
	}
	backupPath := ""
	if oldInfo != nil {
		if os.Geteuid() == 0 {
			if owner, ok := fileOwner(oldInfo); ok {
				_ = os.Chown(tempPath, owner.uid, owner.gid)
			}
		}
		backupPath = binaryPath + ".h-ui-backup-" + time.Now().Format("20060102150405")
		if err = os.Rename(binaryPath, backupPath); err != nil {
			return restartOldService(fmt.Errorf("back up existing Xray binary: %w", err))
		}
	}
	if err = os.Rename(tempPath, binaryPath); err != nil {
		if backupPath != "" {
			_ = os.Rename(backupPath, binaryPath)
		}
		return restartOldService(fmt.Errorf("install Xray binary: %w", err))
	}

	rollback := func(cause error) error {
		_ = os.Remove(binaryPath)
		if backupPath != "" {
			_ = os.Rename(backupPath, binaryPath)
		}
		if stopped {
			if restartErr := ControlXrayService(config, "start"); restartErr != nil {
				return fmt.Errorf("%w; restored Xray binary but could not restart service: %v", cause, restartErr)
			}
			stopped = false
		}
		return cause
	}
	if _, err = runXrayCommand(binaryPath, "version"); err != nil {
		return rollback(fmt.Errorf("installed Xray binary failed validation: %w", err))
	}
	if wasRunning {
		if err = ControlXrayService(config, "start"); err != nil {
			return rollback(fmt.Errorf("start upgraded Xray service: %w", err))
		}
		stopped = false
	}
	return nil
}
