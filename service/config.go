package service

import (
	"errors"
	"fmt"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
	"h-ui/dao"
	"h-ui/model/bo"
	"h-ui/model/constant"
	"h-ui/model/entity"
	"os"
	"strconv"
	"strings"
)

func UpdateConfig(key string, value string) error {
	if key == constant.Hysteria2Enable {
		if value == "1" {
			hysteria2Config, err := GetHysteria2Config()
			if err != nil {
				return err
			}
			if hysteria2Config.Listen == nil || *hysteria2Config.Listen == "" {
				logrus.Errorf("hysteria2 config is empty")
				return errors.New("hysteria2 config is empty")
			}
			// 启动Hysteria2
			if err = StartHysteria2(); err != nil {
				return err
			}
		} else {
			if err := StopHysteria2(); err != nil {
				return err
			}
		}
	}
	return dao.UpdateConfig([]string{key}, map[string]interface{}{"value": value})
}

func GetConfig(key string) (entity.Config, error) {
	return dao.GetConfig("key = ?", key)
}

func ListConfig(keys []string) ([]entity.Config, error) {
	return dao.ListConfig("key in ?", keys)
}

func ListConfigNotIn(keys []string) ([]entity.Config, error) {
	return dao.ListConfig("key not in ?", keys)
}

func GetHysteria2Config() (bo.Hysteria2ServerConfig, error) {
	var serverConfig bo.Hysteria2ServerConfig
	config, err := dao.GetConfig("key = ?", constant.Hysteria2Config)
	if err != nil {
		return serverConfig, err
	}
	if err = yaml.Unmarshal([]byte(*config.Value), &serverConfig); err != nil {
		return serverConfig, err
	}
	return serverConfig, nil
}

func UpdateHysteria2Config(hysteria2ServerConfig bo.Hysteria2ServerConfig) error {
	// 默认值
	config, err := dao.ListConfig("key in ?", []string{constant.HUIWebPort, constant.JwtSecret})
	if err != nil {
		return err
	}

	var hUIWebPort string
	var jwtSecret string
	for _, item := range config {
		if *item.Key == constant.HUIWebPort {
			hUIWebPort = *item.Value
		} else if *item.Key == constant.JwtSecret {
			jwtSecret = *item.Value
		}
	}

	if hUIWebPort == "" || jwtSecret == "" {
		logrus.Errorf("hUIWebPort or jwtSecret is nil")
		return errors.New(constant.SysError)
	}

	authHttpUrl, err := GetAuthHttpUrl()
	if err != nil {
		return err
	}

	authType := "http"
	authHttpInsecure := true
	var auth bo.ServerConfigAuth
	auth.Type = &authType
	var http bo.ServerConfigAuthHTTP
	http.URL = &authHttpUrl
	http.Insecure = &authHttpInsecure
	auth.HTTP = &http
	hysteria2ServerConfig.Auth = &auth
	hysteria2ServerConfig.TrafficStats.Secret = &jwtSecret

	yamlConfig, err := yaml.Marshal(&hysteria2ServerConfig)
	if err != nil {
		return err
	}
	if err = dao.UpdateConfig([]string{constant.Hysteria2Config}, map[string]interface{}{"value": string(yamlConfig)}); err != nil {
		return err
	}

	// The panel now exposes the YAML file for inspection and editing, so it has
	// to reflect the stored configuration right away instead of waiting for the
	// next service start.
	return writeHysteria2ConfigYAML(hysteria2ServerConfig)
}

func SetHysteria2Config(hysteria2ServerConfig bo.Hysteria2ServerConfig) error {
	config, err := yaml.Marshal(&hysteria2ServerConfig)
	if err != nil {
		return err
	}
	return dao.UpdateConfig([]string{constant.Hysteria2Config}, map[string]interface{}{"value": string(config)})
}

// GetHysteria2RawConfig returns the YAML currently written to disk for the
// Hysteria2 process. It is generated from the stored configuration every time
// the service starts, so it is the effective configuration rather than a copy.
func GetHysteria2RawConfig() (string, error) {
	content, err := os.ReadFile(constant.Hysteria2ConfigPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(content), nil
}

// SetHysteria2RawConfig validates an edited YAML document and stores it as the
// Hysteria2 configuration. The auth block and traffic-stats secret are managed
// by the panel and are re-injected afterwards, so editing one of those values
// by hand cannot lock clients or the panel out.
func SetHysteria2RawConfig(content string) error {
	var serverConfig bo.Hysteria2ServerConfig
	if err := yaml.Unmarshal([]byte(content), &serverConfig); err != nil {
		return errors.New("invalid YAML: " + err.Error())
	}
	if serverConfig.Listen == nil || *serverConfig.Listen == "" {
		return errors.New("listen is required")
	}
	if serverConfig.TrafficStats == nil || serverConfig.TrafficStats.Listen == nil {
		return errors.New("trafficStats.listen is required")
	}

	if err := UpdateHysteria2Config(serverConfig); err != nil {
		return err
	}
	return nil
}

// writeHysteria2ConfigYAML serialises a config and replaces the file the
// Hysteria2 process reads.
func writeHysteria2ConfigYAML(serverConfig bo.Hysteria2ServerConfig) error {
	content, err := yaml.Marshal(&serverConfig)
	if err != nil {
		logrus.Errorf("marshal hysteria2 config err: %v", err)
		return errors.New("marshal hysteria2 config err")
	}
	file, err := os.OpenFile(constant.Hysteria2ConfigPath, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0644)
	if err != nil {
		logrus.Errorf("create hysteria2 server config file err: %v", err)
		return errors.New("create hysteria2 server config file err")
	}
	defer file.Close()
	if _, err = file.WriteString(string(content)); err != nil {
		logrus.Errorf("write hysteria2 config file err: %v", err)
		return errors.New("hysteria2 config file write err")
	}
	return nil
}

func UpsertConfig(configs []entity.Config) error {
	return dao.UpsertConfig(configs)
}

func GetHysteria2ApiPort() (int64, error) {
	hysteria2Config, err := GetHysteria2Config()
	if err != nil {
		return 0, err
	}
	if hysteria2Config.TrafficStats == nil || hysteria2Config.TrafficStats.Listen == nil {
		errMsg := "hysteria2 Traffic Stats API (HTTP) Listen is nil"
		logrus.Errorf(errMsg)
		return 0, errors.New(errMsg)
	}
	apiPort, err := strconv.ParseInt(strings.Split(*hysteria2Config.TrafficStats.Listen, ":")[1], 10, 64)
	if err != nil {
		errMsg := fmt.Sprintf("apiPort: %s is invalid", *hysteria2Config.TrafficStats.Listen)
		logrus.Errorf(errMsg)
		return 0, errors.New(errMsg)
	}
	return apiPort, nil
}

func GetPortAndCert() (int64, string, string, error) {
	configs, err := dao.ListConfig("key in ?", []string{constant.HUIWebPort, constant.HUICrtPath, constant.HUIKeyPath})
	if err != nil {
		return 0, "", "", err
	}
	port := ""
	crtPath := ""
	keyPath := ""
	for _, config := range configs {
		value := *config.Value
		if *config.Key == constant.HUIWebPort {
			port = value
		} else if *config.Key == constant.HUICrtPath {
			crtPath = value
		} else if *config.Key == constant.HUIKeyPath {
			keyPath = value
		}
	}

	portInt, err := strconv.ParseInt(port, 10, 64)
	if err != nil {
		logrus.Errorf("port: %s is invalid", port)
		return 0, "", "", errors.New(fmt.Sprintf("port: %s is invalid", port))
	}

	return portInt, crtPath, keyPath, nil
}

func GetAuthHttpUrl() (string, error) {
	port, crtPath, keyPath, err := GetPortAndCert()
	if err != nil {
		return "", err
	}
	protocol := "http"
	if crtPath != "" && keyPath != "" {
		protocol = "https"
	}
	config, err := dao.GetConfig("key = ?", constant.HUIWebContext)
	if err != nil {
		return "", err
	}
	webContext := ""
	if config.Value != nil && *config.Value != "/" && strings.HasPrefix(*config.Value, "/") {
		webContext = *config.Value
	}
	return fmt.Sprintf("%s://127.0.0.1:%d%s/hui/hysteria2/auth", protocol, port, webContext), nil
}
