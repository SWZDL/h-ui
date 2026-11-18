package controller

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/sirupsen/logrus"
	"h-ui/model/constant"
	"h-ui/model/vo"
	"net/http"
	"regexp"
	"strings"
)

var validate *validator.Validate

func init() {
	validate = validator.New()
	_ = validate.RegisterValidation("validateStr", validateStr)
}

func validateStr(f validator.FieldLevel) bool {
	field := f.Field().String()
	// 字符串必须6-32位是字母或者数字或部分特殊字符的组合
	reg := "^[a-zA-Z0-9!@#$%^&*()_+-=]{6,32}$"
	compile := regexp.MustCompile(reg)
	return field == "" || compile.MatchString(field)
}

func validateField[T interface{}](c *gin.Context, field T) (T, error) {
	var bindErr error
	switch c.Request.Method {
	case http.MethodGet:
		bindErr = c.ShouldBindQuery(&field)
	case http.MethodPost, http.MethodPut, http.MethodDelete:
		bindErr = c.ShouldBindJSON(&field)
	}
	// A rejected number (for example a fractional byte count) must not look like
	// a successful request: report it instead of silently keeping the old value.
	if bindErr != nil {
		logrus.Warnf("%s %s: %v", c.Request.Method, c.FullPath(), bindErr)
		vo.Fail(constant.InvalidError, c)
		return field, fmt.Errorf(constant.InvalidError)
	}
	if err := validate.Struct(&field); err != nil {
		message := constant.InvalidError
		var fieldErrors validator.ValidationErrors
		if errors.As(err, &fieldErrors) && len(fieldErrors) > 0 {
			// Name the offending field so the message is actionable.
			message = fmt.Sprintf("%s: %s", constant.InvalidError, strings.ToLower(fieldErrors[0].Field()))
		}
		logrus.Warnf("%s %s: %v", c.Request.Method, c.FullPath(), err)
		vo.Fail(message, c)
		return field, fmt.Errorf("%s", message)
	}
	return field, nil
}
