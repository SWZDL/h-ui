package entity

type Account struct {
	Username          *string `gorm:"column:username;default:''" json:"username"`
	Pass              *string `gorm:"column:pass;default:''" json:"pass"`
	ConPass           *string `gorm:"column:con_pass;default:''" json:"conPass"`
	VlessUUID         *string `gorm:"column:vless_uuid;default:''" json:"vlessUUID"`
	Quota             *int64  `gorm:"column:quota;default:0" json:"quota"`
	Download          *int64  `gorm:"column:download;default:0" json:"download"`
	Upload            *int64  `gorm:"column:upload;default:0" json:"upload"`
	Hysteria2Download *int64  `gorm:"column:hysteria2_download;default:0" json:"hysteria2Download"`
	Hysteria2Upload   *int64  `gorm:"column:hysteria2_upload;default:0" json:"hysteria2Upload"`
	VlessDownload     *int64  `gorm:"column:vless_download;default:0" json:"vlessDownload"`
	VlessUpload       *int64  `gorm:"column:vless_upload;default:0" json:"vlessUpload"`
	ExpireTime        *int64  `gorm:"column:expire_time;default:0" json:"expireTime"`
	KickUtilTime      *int64  `gorm:"column:kick_util_time;default:0" json:"kickUtilTime"`
	DeviceNo          *int64  `gorm:"column:device_no;default:3" json:"deviceNo"`
	Role              *string `gorm:"column:role;default:'user'" json:"role"`
	Deleted           *int64  `gorm:"column:deleted;default:0" json:"deleted"`
	BaseEntity        `gorm:"embedded"`

	LoginAt *int64  `gorm:"column:login_at;default:0" json:"loginAt"`
	ConAt   *int64  `gorm:"column:con_at;default:0" json:"conAt"`
	Remark  *string `gorm:"column:remark;default:''" json:"remark"`
}
