package service

import (
	"encoding/base64"
	"errors"
	"fmt"
	"gopkg.in/yaml.v3"
	"h-ui/dao"
	"h-ui/model/bo"
	"h-ui/model/constant"
	"h-ui/proxy"
	"net/url"
	"strings"
	"time"
)

func Hysteria2Auth(conPass string) (int64, string, error) {
	if !Hysteria2IsRunning() {
		return 0, "", errors.New("hysteria2 is not running")
	}

	now := time.Now().UnixMilli()
	account, err := dao.GetAccount("con_pass = ? and deleted = 0 and (quota < 0 or quota > download + upload) and ? < expire_time and ? > kick_util_time", conPass, now, now)
	if err != nil {
		return 0, "", err
	}

	// 限制设备数
	onlineUsers, err := Hysteria2Online()
	if err != nil {
		return 0, "", err
	}
	device, exist := onlineUsers[*account.Username]
	if exist && *account.DeviceNo <= device {
		return 0, "", errors.New("device limited")
	}

	return *account.Id, *account.Username, nil
}

func Hysteria2Online() (map[string]int64, error) {
	if !Hysteria2IsRunning() {
		return map[string]int64{}, nil
	}
	apiPort, err := GetHysteria2ApiPort()
	if err != nil {
		return nil, errors.New("get hysteria2 apiPort err")
	}
	jwtSecretConfig, err := dao.GetConfig("key = ?", constant.JwtSecret)
	if err != nil {
		return nil, err
	}
	onlineUsers, err := proxy.NewHysteria2Api(apiPort).OnlineUsers(*jwtSecretConfig.Value)
	if err != nil {
		return nil, err
	}
	return onlineUsers, nil
}

func Hysteria2Kick(ids []int64, kickUtilTime int64) error {
	if len(ids) == 0 {
		return nil
	}
	if err := dao.UpdateAccount(ids, map[string]interface{}{"kick_util_time": kickUtilTime}); err != nil {
		return err
	}

	accounts, err := dao.ListAccount("id in ?", ids)
	if err != nil {
		return err
	}
	var hysteriaErr error
	if Hysteria2IsRunning() {
		keys := make([]string, 0, len(accounts))
		for _, item := range accounts {
			keys = append(keys, *item.Username)
		}
		apiPort, apiErr := GetHysteria2ApiPort()
		if apiErr == nil {
			jwtSecretConfig, secretErr := dao.GetConfig("key = ?", constant.JwtSecret)
			apiErr = secretErr
			if apiErr == nil {
				apiErr = proxy.NewHysteria2Api(apiPort).KickUsers(keys, *jwtSecretConfig.Value)
			}
		}
		hysteriaErr = apiErr
	}

	if config, configErr := GetVlessConfig(); configErr == nil && config.Enabled {
		emails := make([]string, 0, len(accounts))
		for _, item := range accounts {
			emails = append(emails, fmt.Sprintf("%s%d", proxy.ManagedXrayEmailPrefix, *item.Id))
		}
		if err := proxy.NewXrayAPI(config).RemoveUsers(emails); err != nil {
			return err
		}
		return nil
	}
	return hysteriaErr
}

func Hysteria2SubscribeUrl(accountId int64, protocol string, host string) (string, error) {
	account, err := dao.GetAccount("id = ?", accountId)
	if err != nil {
		return "", err
	}
	config, err := dao.GetConfig("key = ?", constant.HUIWebContext)
	if err != nil {
		return "", err
	}
	webContext := ""
	if config.Value != nil && *config.Value != "/" && strings.HasPrefix(*config.Value, "/") {
		webContext = *config.Value
	}
	return fmt.Sprintf("%s//%s%s/hui/%s", protocol, host, webContext, url.QueryEscape(*account.ConPass)), nil
}

func Hysteria2Subscribe(conPass string, clientType string, host string) (string, string, error) {
	return hysteria2Subscribe(conPass, clientType, host, true)
}

func hysteria2Subscribe(conPass string, clientType string, host string, includeClashExtension bool) (string, string, error) {
	hysteria2Config, err := GetHysteria2Config()
	if err != nil {
		return "", "", err
	}
	if hysteria2Config.Listen == nil || *hysteria2Config.Listen == "" {
		return "", "", errors.New("hysteria2 config is empty")
	}

	account, err := dao.GetAccount("con_pass = ?", conPass)
	if err != nil {
		return "", "", err
	}

	hysteria2Name := "hysteria2"
	hysteria2ConfigRemark, err := dao.GetConfig("key = ?", constant.Hysteria2ConfigRemark)
	if err != nil {
		return "", "", err
	}
	if *hysteria2ConfigRemark.Value != "" {
		hysteria2Name = *hysteria2ConfigRemark.Value
	}

	hysteria2ConfigPortHopping, err := dao.GetConfig("key = ?", constant.Hysteria2ConfigPortHopping)
	if err != nil {
		return "", "", err
	}

	userInfo := ""
	configStr := ""
	if clientType == constant.Shadowrocket || clientType == constant.Clash || clientType == constant.Loon {
		userInfo = fmt.Sprintf("upload=%d; download=%d; total=%d; expire=%d",
			*account.Upload,
			*account.Download,
			*account.Quota,
			*account.ExpireTime/1000)

		hysteria2 := bo.Hysteria2{
			Name:     hysteria2Name,
			Type:     "hysteria2",
			Server:   strings.Split(host, ":")[0],
			Port:     strings.Split(*hysteria2Config.Listen, ":")[1],
			Ports:    *hysteria2ConfigPortHopping.Value,
			Password: conPass,
		}

		if hysteria2Config.Bandwidth != nil {
			if hysteria2Config.Bandwidth.Up != nil &&
				*hysteria2Config.Bandwidth.Up != "" {
				hysteria2.Up = *hysteria2Config.Bandwidth.Up
			}
			if hysteria2Config.Bandwidth.Down != nil &&
				*hysteria2Config.Bandwidth.Down != "" {
				hysteria2.Down = *hysteria2Config.Bandwidth.Down
			}
		}

		if hysteria2Config.Obfs != nil &&
			hysteria2Config.Obfs.Type != nil &&
			*hysteria2Config.Obfs.Type == "salamander" &&
			hysteria2Config.Obfs.Salamander != nil &&
			hysteria2Config.Obfs.Salamander.Password != nil &&
			*hysteria2Config.Obfs.Salamander.Password != "" {
			if clientType == constant.Shadowrocket {
				hysteria2.Obfs = *hysteria2Config.Obfs.Salamander.Password
			} else {
				hysteria2.Obfs = "salamander"
				hysteria2.ObfsPassword = *hysteria2Config.Obfs.Salamander.Password
			}
		}

		if hysteria2Config.ACME != nil &&
			hysteria2Config.ACME.Domains != nil &&
			len(hysteria2Config.ACME.Domains) > 0 {
			hysteria2.Sni = hysteria2Config.ACME.Domains[0]
		}

		hysteria2.SkipCertVerify = false

		if clientType == constant.Loon {
			return userInfo, loonSubscription([]string{buildLoonHysteria2Node(hysteria2)}), nil
		}

		proxyGroup := bo.ProxyGroup{
			Name:    "PROXY",
			Type:    "select",
			Proxies: []string{hysteria2Name},
		}

		clashConfig := bo.ClashConfig{
			ProxyGroups: []bo.ProxyGroup{
				proxyGroup,
			},
			Proxies: []interface{}{hysteria2},
		}
		clashConfigYaml, err := yaml.Marshal(&clashConfig)
		if err != nil {
			return "", "", err
		}
		configStr = string(clashConfigYaml)
		if clientType == constant.Clash && includeClashExtension {
			clashExtension, err := GetConfig(constant.ClashExtension)
			if err != nil {
				return "", "", err
			}
			if clashExtension.Value != nil && *clashExtension.Value != "" {
				configStr = fmt.Sprintf("%s%s", configStr, *clashExtension.Value)
			}
		}
	} else if clientType == constant.V2rayN {
		hysteria2Url, err := Hysteria2Url(*account.Id, strings.Split(host, ":")[0])
		if err != nil {
			return "", "", err
		}
		configStr = hysteria2Url
	}

	return userInfo, configStr, nil
}

// ProxySubscribe includes only protocols whose services are currently running.
func ProxySubscribe(conPass string, clientType string, host string) (string, string, error) {
	vlessRunning := false
	if config, err := GetVlessConfig(); err == nil && config.Enabled {
		if status, statusErr := proxy.XrayServiceStatusFor(config); statusErr == nil {
			vlessRunning = status.Running
		}
	}
	return proxySubscribeForRunningServices(conPass, clientType, host, Hysteria2IsRunning(), vlessRunning)
}

func proxySubscribeForRunningServices(conPass string, clientType string, host string, hysteria2Running bool, vlessRunning bool) (string, string, error) {
	if !hysteria2Running && !vlessRunning {
		return "", "", errors.New("no proxy service is running")
	}
	if clientType != constant.Shadowrocket && clientType != constant.Clash && clientType != constant.V2rayN &&
		clientType != constant.NekoBox && clientType != constant.Loon {
		clientType = constant.Clash
	}

	if clientType == constant.V2rayN || clientType == constant.NekoBox {
		urls := make([]string, 0, 2)
		userInfo := ""
		if hysteria2Running {
			_, hysteria2URL, err := Hysteria2Subscribe(conPass, constant.V2rayN, host)
			if err != nil {
				return "", "", err
			}
			urls = append(urls, strings.TrimSpace(hysteria2URL))
		}
		if vlessRunning {
			vlessInfo, encodedVlessURL, err := VlessSubscribe(conPass, "")
			if err != nil {
				return "", "", err
			}
			if userInfo == "" {
				userInfo = vlessInfo
			}
			vlessURL, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encodedVlessURL))
			if err != nil {
				return "", "", fmt.Errorf("decode VLESS subscription: %w", err)
			}
			urls = append(urls, strings.TrimSpace(string(vlessURL)))
		}
		return userInfo, strings.Join(urls, "\n"), nil
	}

	if clientType == constant.Loon {
		sections := make([]string, 0, 2)
		userInfo := ""
		if hysteria2Running {
			hysteria2Info, section, err := hysteria2Subscribe(conPass, constant.Loon, host, false)
			if err != nil {
				return "", "", err
			}
			userInfo = hysteria2Info
			sections = append(sections, section)
		}
		if vlessRunning {
			vlessInfo, section, err := VlessSubscribe(conPass, constant.Loon)
			if err != nil {
				return "", "", err
			}
			if userInfo == "" {
				userInfo = vlessInfo
			}
			sections = append(sections, section)
		}
		return userInfo, mergeLoonSubscriptions(sections...), nil
	}

	configs := make([]string, 0, 2)
	userInfo := ""
	if hysteria2Running {
		hysteria2Info, hysteria2Config, err := hysteria2Subscribe(conPass, clientType, host, false)
		if err != nil {
			return "", "", err
		}
		userInfo = hysteria2Info
		configs = append(configs, hysteria2Config)
	}
	if vlessRunning {
		vlessInfo, vlessConfig, err := VlessSubscribe(conPass, constant.Clash)
		if err != nil {
			return "", "", err
		}
		if userInfo == "" {
			userInfo = vlessInfo
		}
		configs = append(configs, vlessConfig)
	}

	combined := configs[0]
	if len(configs) == 2 {
		var err error
		combined, err = mergeClashSubscriptions(configs[0], configs[1])
		if err != nil {
			return "", "", err
		}
	}
	if clientType == constant.Clash {
		extension, err := GetConfig(constant.ClashExtension)
		if err != nil {
			return "", "", err
		}
		if extension.Value != nil && *extension.Value != "" {
			combined += *extension.Value
		}
	}
	return userInfo, combined, nil
}

func mergeClashSubscriptions(first string, second string) (string, error) {
	var combined, additional bo.ClashConfig
	if err := yaml.Unmarshal([]byte(first), &combined); err != nil {
		return "", fmt.Errorf("parse Hysteria2 Clash subscription: %w", err)
	}
	if err := yaml.Unmarshal([]byte(second), &additional); err != nil {
		return "", fmt.Errorf("parse VLESS Clash subscription: %w", err)
	}
	combined.Proxies = append(combined.Proxies, additional.Proxies...)
	for _, next := range additional.ProxyGroups {
		merged := false
		for index := range combined.ProxyGroups {
			if combined.ProxyGroups[index].Name == next.Name && combined.ProxyGroups[index].Type == next.Type {
				combined.ProxyGroups[index].Proxies = append(combined.ProxyGroups[index].Proxies, next.Proxies...)
				merged = true
				break
			}
		}
		if !merged {
			combined.ProxyGroups = append(combined.ProxyGroups, next)
		}
	}
	content, err := yaml.Marshal(&combined)
	if err != nil {
		return "", fmt.Errorf("encode combined Clash subscription: %w", err)
	}
	return string(content), nil
}

func Hysteria2Url(accountId int64, hostname string) (string, error) {
	hysteria2Config, err := GetHysteria2Config()
	if err != nil {
		return "", err
	}
	if hysteria2Config.Listen == nil || *hysteria2Config.Listen == "" {
		return "", errors.New("hysteria2 config is empty")
	}

	account, err := dao.GetAccount("id = ?", accountId)
	if err != nil {
		return "", err
	}

	urlConfig := ""
	if hysteria2Config.Obfs != nil &&
		hysteria2Config.Obfs.Type != nil &&
		*hysteria2Config.Obfs.Type == "salamander" &&
		hysteria2Config.Obfs.Salamander != nil &&
		hysteria2Config.Obfs.Salamander.Password != nil &&
		*hysteria2Config.Obfs.Salamander.Password != "" {
		urlConfig += fmt.Sprintf("&obfs=salamander&obfs-password=%s", *hysteria2Config.Obfs.Salamander.Password)
	}

	if hysteria2Config.ACME != nil &&
		hysteria2Config.ACME.Domains != nil &&
		len(hysteria2Config.ACME.Domains) > 0 {
		urlConfig += fmt.Sprintf("&sni=%s", hysteria2Config.ACME.Domains[0])
		// shadowrocket
		urlConfig += fmt.Sprintf("&peer=%s", hysteria2Config.ACME.Domains[0])
	}

	urlConfig += "&insecure=0"

	if hysteria2Config.Bandwidth != nil &&
		hysteria2Config.Bandwidth.Down != nil &&
		*hysteria2Config.Bandwidth.Down != "" {
		// shadowrocket
		urlConfig += fmt.Sprintf("&downmbps=%s", url.PathEscape(*hysteria2Config.Bandwidth.Down))
	}

	hysteria2ConfigPortHopping, err := dao.GetConfig("key = ?", constant.Hysteria2ConfigPortHopping)
	if err != nil {
		return "", err
	}
	if *hysteria2ConfigPortHopping.Value != "" {
		// shadowrocket
		urlConfig += fmt.Sprintf("&mport=%s", *hysteria2ConfigPortHopping.Value)
	}

	hysteria2ConfigRemark, err := dao.GetConfig("key = ?", constant.Hysteria2ConfigRemark)
	if err != nil {
		return "", err
	}
	if *hysteria2ConfigRemark.Value != "" {
		urlConfig += fmt.Sprintf("#%s", *hysteria2ConfigRemark.Value)
	}
	if urlConfig != "" {
		urlConfig = "/?" + strings.TrimPrefix(urlConfig, "&")
	}
	return fmt.Sprintf("hysteria2://%s@%s%s", *account.ConPass, hostname, *hysteria2Config.Listen) + urlConfig, nil
}
