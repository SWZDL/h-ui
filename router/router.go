package router

import (
	"strings"

	"github.com/gin-gonic/gin"
	"h-ui/frontend"
	"h-ui/frontend_react"
	"h-ui/middleware"
)

// WebFrontend names the embedded SPA that is served at the configured
// context path. Both applications share the same API.
const (
	WebFrontendReact = "react"
	WebFrontendVue   = "vue"
)

func Router(router *gin.Engine, huiWebContext *string, webFrontend string) {
	// global context
	relativePath := "/"
	if huiWebContext != nil && strings.HasPrefix(*huiWebContext, "/") {
		relativePath = *huiWebContext
	}
	globalGroup := router.Group(relativePath)
	{
		globalGroup.Use(middleware.FilterHandler(), middleware.LogHandler(), middleware.RateLimiterHandler())

		if strings.EqualFold(webFrontend, WebFrontendVue) {
			frontend.InitFrontend(router, relativePath)
		} else {
			frontend_react.InitFrontend(router, relativePath)
		}

		authApi := globalGroup.Group("/hui")
		{
			initAuthRouter(authApi)
			initHysteria2AuthRouter(authApi)
		}

		globalGroup.Use(middleware.JWTHandler())

		globalGroup.Use(middleware.AdminHandler())

		huiAdminApi := globalGroup.Group("/hui")
		{
			initAccountAdminRouter(huiAdminApi)
			initConfigRouter(huiAdminApi)
			initHysteria2Router(huiAdminApi)
			initLogRouter(huiAdminApi)
			initMonitorRouter(huiAdminApi)
		}
	}
}
