package frontend

import (
	"embed"
	"encoding/json"
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var staticFiles embed.FS

func InitFrontend(router *gin.Engine, relativePath string) {
	router.GET(relativePath, func(c *gin.Context) {
		indexHTML, err := staticFiles.ReadFile("dist/index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal Server Error")
			return
		}
		c.Data(http.StatusOK, "text/html", []byte(replaceRelativePaths(string(indexHTML), relativePath)))
	})

	router.GET(path.Join(relativePath, "favicon.ico"), func(c *gin.Context) {
		indexHTML, err := staticFiles.ReadFile("dist/favicon.ico")
		if err != nil {
			c.String(http.StatusInternalServerError, "Internal Server Error")
			return
		}
		c.Data(http.StatusOK, "image/x-icon", indexHTML)
	})

	router.StaticFS(path.Join(relativePath, "assets"), http.FS(getStaticFS()))

	router.NoRoute(func(c *gin.Context) {
		filePath := c.Request.URL.Path
		if relativePath != "/" && !strings.HasPrefix(filePath, relativePath) {
			c.String(http.StatusNotFound, "404")
			return
		}
		fileContent, err := getFileContent(filePath)
		if err != nil {
			c.String(http.StatusNotFound, "404")
			return
		}
		c.Data(http.StatusOK, http.DetectContentType(fileContent), fileContent)
	})
}

func getStaticFS() fs.FS {
	staticFs, _ := fs.Sub(staticFiles, "dist/assets")
	return staticFs
}

func getFileContent(filePath string) ([]byte, error) {
	fileContent, err := staticFiles.ReadFile(fmt.Sprintf("dist%s", filePath))
	if err != nil {
		return nil, err
	}
	return fileContent, nil
}

func replaceRelativePaths(htmlContent string, basePath string) string {
	basePath = strings.TrimRight(strings.TrimSpace(basePath), "/")
	if basePath == "/" {
		basePath = ""
	}
	htmlContent = strings.ReplaceAll(htmlContent, "/__dynamic_base__/", basePath+"/")
	baseHref := html.EscapeString(basePath + "/")
	htmlContent = strings.Replace(htmlContent, "<head>", "<head>\n<base href=\""+baseHref+"\">", 1)
	basePathJSON, _ := json.Marshal(basePath)
	injection := fmt.Sprintf(`
	<script>
		window.__dynamic_base__ = %s;
	</script>`, basePathJSON)
	return strings.Replace(htmlContent, "</head>", injection+"</head>", 1)
}
