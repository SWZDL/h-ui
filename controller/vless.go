package controller

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
	"h-ui/model/bo"
	"h-ui/model/constant"
	"h-ui/model/dto"
	"h-ui/model/vo"
	"h-ui/service"
)

func GetVlessConfig(c *gin.Context) {
	config, err := service.GetVlessConfig()
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(config, c)
}

func UpdateVlessConfig(c *gin.Context) {
	var config bo.VlessConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		vo.Fail("invalid VLESS config", c)
		return
	}
	if err := service.SetVlessConfig(config); err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(nil, c)
}

func VlessXrayServiceStatus(c *gin.Context) {
	status, err := service.VlessXrayServiceStatus()
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(status, c)
}

func VlessXrayServiceAction(c *gin.Context) {
	request, err := validateField(c, dto.VlessServiceActionDto{})
	if err != nil {
		return
	}
	if err = service.ControlVlessXrayService(*request.Action); err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(nil, c)
}

func ListXrayReleaseVersions(c *gin.Context) {
	versions, err := service.ListXrayReleaseVersions()
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(versions, c)
}

func UpgradeVlessXray(c *gin.Context) {
	request, err := validateField(c, dto.VlessVersionDto{})
	if err != nil {
		return
	}
	if err = service.UpgradeVlessXray(*request.Version); err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(nil, c)
}

func VlessUrl(c *gin.Context) {
	request, err := validateField(c, dto.VlessUrlDto{})
	if err != nil {
		return
	}
	if err = service.CheckAccountAccess(c, *request.AccountId); err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	link, err := service.VlessUrl(*request.AccountId)
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	qrCode, err := qrcode.Encode(link, qrcode.Medium, 300)
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(vo.VlessUrlVo{Url: link, QrCode: qrCode}, c)
}

func VlessSubscribeUrl(c *gin.Context) {
	request, err := validateField(c, dto.VlessSubscribeUrlDto{})
	if err != nil {
		return
	}
	if err = service.CheckAccountAccess(c, *request.AccountId); err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	link, err := service.VlessSubscribeUrl(*request.AccountId, *request.Protocol, *request.Host)
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	qrCode, err := qrcode.Encode(link, qrcode.Medium, 300)
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	vo.Success(vo.VlessSubscribeVo{Url: link, QrCode: qrCode}, c)
}

func VlessSubscribe(c *gin.Context) {
	// net/http has already decoded the URL path, including escaped bytes.
	conPass := c.Param("conPass")
	userAgent := strings.ToLower(c.Request.Header.Get("User-Agent"))
	clientType := ""
	if strings.Contains(userAgent, constant.Loon) {
		clientType = constant.Loon
	} else if strings.Contains(userAgent, constant.Clash) {
		clientType = constant.Clash
	}
	userInfo, content, err := service.VlessSubscribe(conPass, clientType)
	if err != nil {
		vo.Fail(err.Error(), c)
		return
	}
	c.Header("subscription-userinfo", userInfo)
	c.Header("profile-update-interval", "12")
	if clientType == constant.Clash {
		c.Header("content-disposition", "attachment; filename=vless.yaml")
		c.Data(200, "application/yaml; charset=utf-8", []byte(content))
		return
	}
	if clientType == constant.Loon {
		// Loon parses the plain text [Proxy] section itself.
		c.Data(200, "text/plain; charset=utf-8", []byte(content))
		return
	}
	// V2Ray clients (including v2rayN, NekoBox and Shadowrocket) accept a
	// standard base64-encoded list of VLESS URIs as a subscription response.
	c.String(200, content)
}
