package constant

const (
	LogDir        = "logs/"
	SqliteDBDir   = "data/"
	BinDir        = "bin/"
	ExportPathDir = "export/"

	SqliteDBPath = "data/h_ui.db"

	Hysteria2ConfigPath = "bin/hysteria2.yaml"

	SystemLogPath    = "logs/h-ui.log"
	Hysteria2LogPath = "logs/hysteria2.log"

	TokenType = "Bearer"

	// AccountContextKey is where JWTHandler stores the authenticated account so
	// the authorization helpers do not have to parse the token again.
	AccountContextKey = "h-ui-account"

	RoleAdmin = "admin"
	RoleUser  = "user"

	Version = "v0.1.0"
)
