package cmd

import (
	"fmt"
	"os"
	"strings"

	"h-ui/router"
)

// webFrontendEnv is the environment fallback for --web. The CLI flag always
// wins so systemd/docker users can pin the frontend per deployment.
const webFrontendEnv = "H_UI_WEB_FRONTEND"

// resolveWebFrontend normalises the configured frontend name.
// An empty value keeps the new React application as the default.
func resolveWebFrontend(flagValue string) (string, error) {
	raw := strings.TrimSpace(flagValue)
	source := "--web"

	if raw == "" {
		raw = strings.TrimSpace(os.Getenv(webFrontendEnv))
		source = webFrontendEnv
	}

	if raw == "" {
		return router.WebFrontendReact, nil
	}

	switch strings.ToLower(raw) {
	case "react", "frontend_react", "new":
		return router.WebFrontendReact, nil
	case "vue", "frontend", "legacy":
		return router.WebFrontendVue, nil
	default:
		return "", fmt.Errorf(
			"invalid %s value %q: expected %q or %q",
			source, raw, router.WebFrontendReact, router.WebFrontendVue,
		)
	}
}
