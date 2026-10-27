package router

import (
	"github.com/gin-gonic/gin"
	"h-ui/controller"
)

// initAccountUserRouter exposes the read-only account endpoints available to
// every signed-in account. Handlers restrict non-admin callers to their own
// record.
func initAccountUserRouter(accountApi *gin.RouterGroup) {
	account := accountApi.Group("/account")
	{
		account.GET("/getAccountInfo", controller.GetAccountInfo)
		account.GET("/getAccount", controller.GetAccount)
	}
}

func initAccountAdminRouter(accountApi *gin.RouterGroup) {
	account := accountApi.Group("/account")
	{
		account.GET("/pageAccount", controller.PageAccount)
		account.POST("/saveAccount", controller.SaveAccount)
		account.POST("/deleteAccount", controller.DeleteAccount)
		account.POST("/updateAccount", controller.UpdateAccount)
		account.POST("/resetTraffic", controller.ResetTraffic)
		account.POST("/importAccount", controller.ImportAccount)
		account.POST("/exportAccount", controller.ExportAccount)
		account.POST("/releaseKickAccount", controller.ReleaseKickAccount)
		account.GET("/verifyDefaultPass", controller.VerifyDefaultPass)
	}
}
