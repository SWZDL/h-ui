package middleware

import (
	"path"
	"strings"

	"github.com/didip/tollbooth"
	"github.com/didip/tollbooth/limiter"
	"github.com/gin-gonic/gin"
	"h-ui/model/vo"
)

var (
	// Login is the only endpoint worth throttling: it is the one place where a
	// burst of requests means a guessed password. Everything else is already
	// behind a JWT.
	loginLimiter *limiter.Limiter

	// Reads are cheap and a single page render legitimately fires several of
	// them at once, so the ceiling is generous. It exists to stop runaway
	// polling loops, not to shape normal use.
	requestLimiter *limiter.Limiter
)

func init() {
	loginLimiter = tollbooth.NewLimiter(5, nil)
	loginLimiter.SetMessageContentType("application/json; charset=utf-8")
	loginLimiter.SetMessage(`{"code":50000,"type":"no","message":"too many attempts"}`)

	requestLimiter = tollbooth.NewLimiter(50, nil)
	requestLimiter.SetMessageContentType("application/json; charset=utf-8")
	requestLimiter.SetMessage(`{"code":50000,"type":"no","message":"too many requests"}`)
}

// RateLimiterHandler throttles the login endpoint and applies a much wider
// ceiling elsewhere. It previously ran a single 5 req/s bucket over every
// route, which dropped legitimate requests — a page that fetches its config,
// its raw YAML and its monitor state at once would lose whichever request
// landed last.
func RateLimiterHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		selected := requestLimiter
		if isLoginRequest(c.Request.URL.Path) {
			selected = loginLimiter
		}

		if httpError := tollbooth.LimitByRequest(selected, c.Writer, c.Request); httpError != nil {
			if selected == loginLimiter {
				vo.Fail("too many attempts", c)
			} else {
				vo.Fail("too many requests", c)
			}
			c.Abort()
			return
		}
		c.Next()
	}
}

// isLoginRequest matches the auth endpoint regardless of the mounted context
// path, which is configurable.
func isLoginRequest(requestPath string) bool {
	cleaned := path.Clean("/" + requestPath)
	return strings.HasSuffix(cleaned, "/hui/auth/login") || cleaned == "/login"
}
