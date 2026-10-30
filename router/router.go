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

		// Endpoints every authenticated account may call. Handlers scope their
		// data to the caller unless the caller is an administrator.
		huiUserApi := globalGroup.Group("/hui")
		{
			initAccountUserRouter(huiUserApi)
			initHysteria2UserRouter(huiUserApi)
		}

		// Administrative endpoints. Requiring the admin role here keeps the
		// management surface closed to regular accounts.
		huiAdminApi := globalGroup.Group("/hui", middleware.AdminHandler())
		{
			initAccountAdminRouter(huiAdminApi)
			initConfigRouter(huiAdminApi)
			initHysteria2Router(huiAdminApi)
			initLogRouter(huiAdminApi)
			initMonitorRouter(huiAdminApi)
		}
	}
}
