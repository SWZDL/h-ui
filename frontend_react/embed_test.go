package frontend_react

import (
	"strings"
	"testing"
)

func TestReplaceRelativePathsInjectsSubpathBaseBeforeAssets(t *testing.T) {
	input := `<html><head><script type="module" src="./assets/index.js"></script></head></html>`
	got := replaceRelativePaths(input, "/panel/")
	baseIndex := strings.Index(got, `<base href="/panel/">`)
	assetIndex := strings.Index(got, `src="./assets/index.js"`)
	if baseIndex < 0 || assetIndex < 0 || baseIndex > assetIndex {
		t.Fatalf("base tag must precede relative asset URLs: %s", got)
	}
	if !strings.Contains(got, `window.__dynamic_base__ = "/panel"`) {
		t.Fatalf("API base path was not injected: %s", got)
	}
}

func TestReplaceRelativePathsUsesRootBase(t *testing.T) {
	got := replaceRelativePaths(`<html><head></head></html>`, "/")
	if !strings.Contains(got, `<base href="/">`) || !strings.Contains(got, `window.__dynamic_base__ = ""`) {
		t.Fatalf("unexpected root path injection: %s", got)
	}
}
