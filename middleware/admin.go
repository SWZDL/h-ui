package middleware

import (
	"github.com/gin-gonic/gin"
	"h-ui/model/constant"
	"h-ui/model/vo"
	"h-ui/service"
)

func AdminHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		accountBo, err := service.GetCurrentAccount(c)
		if err != nil {
			vo.Fail(err.Error(), c)
			c.Abort()
			return
		}
		if !service.IsAdmin(accountBo) {
			vo.Fail(constant.ForbiddenError, c)
			c.Abort()
			return
		}
		c.Next()
	}
}
