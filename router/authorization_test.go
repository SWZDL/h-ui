package router_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"h-ui/dao"
	"h-ui/model/entity"
	"h-ui/router"
	"h-ui/util"
)

type apiResult struct {
	Code    int             `json:"code"`
	Type    string          `json:"type"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type loginVo struct {
	TokenType   string `json:"tokenType"`
	AccessToken string `json:"accessToken"`
}

func call(t *testing.T, engine *gin.Engine, method, path, token string, body any) apiResult {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "h-ui-test")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	var result apiResult
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("%s %s: decode response %q: %v", method, path, w.Body.String(), err)
	}
	return result
}

func login(t *testing.T, engine *gin.Engine, username, pass string) string {
	t.Helper()
	result := call(t, engine, http.MethodPost, "/hui/auth/login", "", map[string]string{
		"username": username,
		"pass":     pass,
	})
	if result.Code != 20000 {
		t.Fatalf("login %s failed: code=%d message=%s", username, result.Code, result.Message)
	}
	var data loginVo
	if err := json.Unmarshal(result.Data, &data); err != nil {
		t.Fatalf("decode login data: %v", err)
	}
	return fmt.Sprintf("%s %s", data.TokenType, data.AccessToken)
}

func setup(t *testing.T) *gin.Engine {
	t.Helper()

	root := t.TempDir()
	t.Cleanup(func() { _ = dao.CloseSqliteDB() })
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o755); err != nil {
		t.Fatalf("create data dir: %v", err)
	}
	t.Setenv("HUI_DATA", root+string(os.PathSeparator))
	if err := dao.InitSql(""); err != nil {
		t.Fatalf("init sql: %v", err)
	}

	username := "testuser"
	pass := util.SHA224String("userpass")
	conPass := "testuser.userpass"
	quota := int64(1024)
	zero := int64(0)
	expire := int64(253370736000000)
	deviceNo := int64(3)
	role := "user"
	remark := "regular account"
	account := entity.Account{
		Username:     &username,
		Pass:         &pass,
		ConPass:      &conPass,
		Quota:        &quota,
		Download:     &zero,
		Upload:       &zero,
		ExpireTime:   &expire,
		KickUtilTime: &zero,
		DeviceNo:     &deviceNo,
		Role:         &role,
		Deleted:      &zero,
		LoginAt:      &zero,
		ConAt:        &zero,
		Remark:       &remark,
	}
	if _, err := dao.SaveAccount(account); err != nil {
		t.Fatalf("save regular account: %v", err)
	}

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	ctx := "/"
	router.Router(engine, &ctx, "react")
	return engine
}

func TestRegularAccountCanOnlyReadItself(t *testing.T) {
	engine := setup(t)
	userToken := login(t, engine, "testuser", "userpass")

	// Profile lookup is available to every account.
	info := call(t, engine, http.MethodGet, "/hui/account/getAccountInfo", userToken, nil)
	if info.Code != 20000 {
		t.Fatalf("getAccountInfo: code=%d message=%s", info.Code, info.Message)
	}
	if !strings.Contains(string(info.Data), `"user"`) {
		t.Fatalf("regular login should carry the user role, got %s", info.Data)
	}

	// Reading its own record works.
	own := call(t, engine, http.MethodGet, "/hui/account/getAccount?id=2", userToken, nil)
	if own.Code != 20000 || !strings.Contains(string(own.Data), `"testuser"`) {
		t.Fatalf("read own account: code=%d data=%s message=%s", own.Code, own.Data, own.Message)
	}

	// Reading another account is forbidden.
	other := call(t, engine, http.MethodGet, "/hui/account/getAccount?id=1", userToken, nil)
	if other.Code != 50403 {
		t.Fatalf("read foreign account: want 50403, got code=%d message=%s", other.Code, other.Message)
	}

	// Foreign subscription / node URLs are forbidden before any config work.
	foreignUrl := call(t, engine, http.MethodGet, "/hui/hysteria2/hysteria2Url?accountId=1&hostname=localhost", userToken, nil)
	if foreignUrl.Code != 50403 {
		t.Fatalf("foreign node url: want 50403, got code=%d message=%s", foreignUrl.Code, foreignUrl.Message)
	}
	foreignSub := call(t, engine, http.MethodGet, "/hui/hysteria2/hysteria2SubscribeUrl?accountId=1&protocol=http&host=localhost", userToken, nil)
	if foreignSub.Code != 50403 {
		t.Fatalf("foreign subscribe url: want 50403, got code=%d message=%s", foreignSub.Code, foreignSub.Message)
	}
}

func TestRegularAccountCannotUseAdminEndpoints(t *testing.T) {
	engine := setup(t)
	userToken := login(t, engine, "testuser", "userpass")
	paths := []struct {
		method string
		path   string
		body   any
	}{
		{http.MethodGet, "/hui/account/pageAccount?pageNum=1&pageSize=10", nil},
		{http.MethodGet, "/hui/account/verifyDefaultPass", nil},
		{http.MethodPost, "/hui/account/updateAccount", map[string]any{"id": 2, "quota": 2048}},
		{http.MethodPost, "/hui/account/saveAccount", map[string]any{
			"username": "newuser", "pass": "newpass", "conPass": "newpass", "quota": 0,
			"expireTime": 0, "deviceNo": 1, "deleted": 0, "remark": "",
		}},
		{http.MethodPost, "/hui/account/deleteAccount", map[string]any{"id": 1}},
		{http.MethodGet, "/hui/config/getConfig", nil},
		{http.MethodGet, "/hui/log/logSystem", nil},
		{http.MethodGet, "/hui/monitor/monitorSystem", nil},
	}
	for _, item := range paths {
		result := call(t, engine, item.method, item.path, userToken, item.body)
		if result.Code != 50403 {
			t.Errorf("%s %s: want 50403, got code=%d message=%s", item.method, item.path, result.Code, result.Message)
		}
	}
}

func TestAdminKeepsFullAccess(t *testing.T) {
	engine := setup(t)
	adminToken := login(t, engine, "sysadmin", "sysadmin")

	page := call(t, engine, http.MethodGet, "/hui/account/pageAccount?pageNum=1&pageSize=10", adminToken, nil)
	if page.Code != 20000 {
		t.Fatalf("admin pageAccount: code=%d message=%s", page.Code, page.Message)
	}
	user := call(t, engine, http.MethodGet, "/hui/account/getAccount?id=2", adminToken, nil)
	if user.Code != 20000 || !strings.Contains(string(user.Data), `"testuser"`) {
		t.Fatalf("admin read other account: code=%d data=%s message=%s", user.Code, user.Data, user.Message)
	}
}

func TestUnauthenticatedRequestsAreRejected(t *testing.T) {
	engine := setup(t)
	result := call(t, engine, http.MethodGet, "/hui/account/getAccountInfo", "", nil)
	if result.Code != 50401 {
		t.Fatalf("unauthenticated request: want 50401, got code=%d message=%s", result.Code, result.Message)
	}
}
