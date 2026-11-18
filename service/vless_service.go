package service

import (
	"errors"
	"runtime"
	"strings"

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
