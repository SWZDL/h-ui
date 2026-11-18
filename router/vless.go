package router

import (
	"github.com/gin-gonic/gin"
	"h-ui/controller"
)

func initVlessAuthRouter(vlessApi *gin.RouterGroup) {
	vlessApi.GET("/vless/subscribe/:conPass", controller.VlessSubscribe)
}

func initVlessUserRouter(vlessApi *gin.RouterGroup) {
	vless := vlessApi.Group("/vless")
	{
		vless.GET("/vlessSubscribeUrl", controller.VlessSubscribeUrl)
		vless.GET("/vlessUrl", controller.VlessUrl)
	}
}

func initVlessAdminRouter(vlessApi *gin.RouterGroup) {
	vless := vlessApi.Group("/vless")
	{
		vless.GET("/getVlessConfig", controller.GetVlessConfig)
		vless.POST("/updateVlessConfig", controller.UpdateVlessConfig)
	}
}
