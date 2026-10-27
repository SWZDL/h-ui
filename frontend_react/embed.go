package frontend_react

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var staticFiles embed.FS

const (
	// Asset filenames carry a content hash, so they never change under the same
	// URL and can be cached indefinitely.
	immutableCache = "public, max-age=31536000, immutable"
	// The HTML entry point references those hashed filenames and must be
	// revalidated on every load; an ETag makes that a bodiless 304.
	revalidateCache = "no-cache"
)

// Explicit table instead of mime.TypeByExtension: the result must not depend on
// the host's mime.types file, and charset must always be present.
var contentTypes = map[string]string{
	".css":   "text/css; charset=utf-8",
	".js":    "text/javascript; charset=utf-8",
	".mjs":   "text/javascript; charset=utf-8",
	".html":  "text/html; charset=utf-8",
	".json":  "application/json; charset=utf-8",
	".svg":   "image/svg+xml",
	".ico":   "image/x-icon",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".jpeg":  "image/jpeg",
	".webp":  "image/webp",
	".gif":   "image/gif",
	".woff":  "font/woff",
	".woff2": "font/woff2",
	".ttf":   "font/ttf",
	".txt":   "text/plain; charset=utf-8",
	".map":   "application/json; charset=utf-8",
}

// embedServer serves the embedded SPA with pre-compressed variants. The
// .br/.gz siblings are produced at build time by scripts/precompress.mjs, so
// request handling is a map lookup plus a header set — no compression work on
// the request path.
type embedServer struct {
	files map[string]bool
	etags map[string]string
	fsys  fs.FS
}

func newEmbedServer(fsys fs.FS) *embedServer {
	s := &embedServer{
		files: make(map[string]bool),
		etags: make(map[string]string),
		fsys:  fsys,
	}
	_ = fs.WalkDir(fsys, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		name = strings.TrimPrefix(name, "./")
		s.files[name] = true
		if content, readErr := fs.ReadFile(fsys, name); readErr == nil {
			sum := sha256.Sum256(content)
			s.etags[name] = `"` + hex.EncodeToString(sum[:10]) + `"`
		}
		return nil
	})
	return s
}

func (s *embedServer) has(name string) bool {
	return s.files[name]
}

// serve writes name with the best pre-compressed variant the client accepts.
// cacheControl is applied verbatim; the ETag is derived from the bytes actually
// sent, so each encoding has its own validator.
func (s *embedServer) serve(c *gin.Context, name string, cacheControl string) {
	original, err := fs.ReadFile(s.fsys, name)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	body := original
	encoding := ""
	validator := s.etags[name]

	switch {
	case s.has(name+".br") && acceptsEncoding(c.GetHeader("Accept-Encoding"), "br"):
		if compressed, readErr := fs.ReadFile(s.fsys, name+".br"); readErr == nil {
			body, encoding = compressed, "br"
			validator = s.etags[name+".br"]
		}
	case s.has(name+".gz") && acceptsEncoding(c.GetHeader("Accept-Encoding"), "gzip"):
		if compressed, readErr := fs.ReadFile(s.fsys, name+".gz"); readErr == nil {
			body, encoding = compressed, "gzip"
			validator = s.etags[name+".gz"]
		}
	}

	contentType := contentTypes[strings.ToLower(path.Ext(name))]
	if contentType == "" {
		contentType = http.DetectContentType(original)
	}

	h := c.Writer.Header()
	if encoding != "" {
		h.Set("Content-Encoding", encoding)
		h.Set("Vary", "Accept-Encoding")
	}
	if validator != "" {
		h.Set("ETag", validator)
	}
	if cacheControl != "" {
		h.Set("Cache-Control", cacheControl)
	}

	if validator != "" && etagMatches(c.GetHeader("If-None-Match"), validator) {
		c.Status(http.StatusNotModified)
		return
	}

	// Stating the length lets the browser show progress and avoids chunked
	// framing; the payload is already in memory, so the size is known.
	h.Set("Content-Length", strconv.Itoa(len(body)))

	c.Data(http.StatusOK, contentType, body)
}

// InitFrontend serves the React single-page application. The HTML entry point
// has its base path rewritten at runtime so the panel can live on any
// sub-path configured through H_UI_WEB_CONTEXT.
func InitFrontend(router *gin.Engine, relativePath string) {
	server := newEmbedServer(staticFiles)

	// The context path is fixed for the lifetime of the process, so the entry
	// document is rendered once instead of on every navigation.
	indexHTML := ""
	if raw, err := staticFiles.ReadFile("dist/index.html"); err == nil {
		indexHTML = replaceRelativePaths(string(raw), relativePath)
	}
	indexETag := ""
	if indexHTML != "" {
		sum := sha256.Sum256([]byte(indexHTML))
		indexETag = `"` + hex.EncodeToString(sum[:10]) + `"`
	}

	router.GET(relativePath, func(c *gin.Context) {
		if indexHTML == "" {
			c.String(http.StatusInternalServerError, "Internal Server Error")
			return
		}
		h := c.Writer.Header()
		h.Set("Cache-Control", revalidateCache)
		h.Set("ETag", indexETag)
		if etagMatches(c.GetHeader("If-None-Match"), indexETag) {
			c.Status(http.StatusNotModified)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(indexHTML))
	})

	router.GET(path.Join(relativePath, "favicon.ico"), func(c *gin.Context) {
		server.serve(c, "dist/favicon.ico", immutableCache)
	})

	assets := router.Group(path.Join(relativePath, "assets"))
	assets.GET("/*filepath", func(c *gin.Context) {
		name := internalName("dist/assets", c.Param("filepath"))
		if name == "" {
			c.Status(http.StatusNotFound)
			return
		}
		server.serve(c, name, immutableCache)
	})

	router.NoRoute(func(c *gin.Context) {
		requestPath := c.Request.URL.Path
		if relativePath != "/" && !strings.HasPrefix(requestPath, relativePath) {
			c.String(http.StatusNotFound, "404")
			return
		}
		name := internalName("dist", strings.TrimPrefix(requestPath, strings.TrimSuffix(relativePath, "/")))
		if name == "" {
			c.String(http.StatusNotFound, "404")
			return
		}
		server.serve(c, name, revalidateCache)
	})
}

// internalName joins a cleaned request path onto prefix, rejecting anything
// that escapes the embedded tree.
func internalName(prefix string, requestPath string) string {
	cleaned := path.Clean("/" + requestPath)
	if cleaned == "/" {
		return ""
	}
	return prefix + cleaned
}

// acceptsEncoding reports whether the Accept-Encoding header allows name,
// honouring q-values and the * wildcard.
func acceptsEncoding(header string, name string) bool {
	if header == "" {
		return false
	}
	wildcard := false
	for _, part := range strings.Split(header, ",") {
		fields := strings.Split(strings.TrimSpace(part), ";")
		token := strings.ToLower(strings.TrimSpace(fields[0]))
		quality := 1.0
		for _, param := range fields[1:] {
			param = strings.TrimSpace(param)
			if strings.HasPrefix(strings.ToLower(param), "q=") {
				if value, err := strconv.ParseFloat(strings.TrimSpace(param[2:]), 64); err == nil {
					quality = value
				}
			}
		}
		if quality <= 0 {
			continue
		}
		if token == name {
			return true
		}
		if token == "*" {
			wildcard = true
		}
	}
	return wildcard
}

// etagMatches implements the If-None-Match comparison, including weak
// validators and the * form.
func etagMatches(header string, etag string) bool {
	if header == "" {
		return false
	}
	if strings.TrimSpace(header) == "*" {
		return true
	}
	target := strings.TrimPrefix(etag, "W/")
	for _, candidate := range strings.Split(header, ",") {
		if strings.TrimPrefix(strings.TrimSpace(candidate), "W/") == target {
			return true
		}
	}
	return false
}

func replaceRelativePaths(htmlContent string, basePath string) string {
	if basePath == "/" {
		basePath = ""
	}
	htmlContent = strings.ReplaceAll(htmlContent, "/__dynamic_base__/", basePath+"/")
	injection := fmt.Sprintf(`
	<script>
		window.__dynamic_base__ = "%s";
	</script>`, basePath)
	return strings.Replace(htmlContent, "</head>", injection+"</head>", 1)
}
