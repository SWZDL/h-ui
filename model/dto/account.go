package dto

type AccountPageDto struct {
	BaseDto
	Username *string `json:"username" form:"username" validate:"omitempty,min=1,max=32"`
	Deleted  *int64  `json:"deleted" form:"deleted" validate:"omitempty,oneof=0 1"`
	Remark   *string `json:"remark" form:"remark" validate:"omitempty,min=0,max=32"`
}

type LoginDto struct {
	Username *string `json:"username" form:"username" validate:"required,min=6,max=32,validateStr"`
	Pass     *string `json:"pass" form:"pass" validate:"required,min=6,max=32,validateStr"`
}

// validateStr already enforces the 6-32 character alphabet, so the length tags
// would only make an empty optional value fail: a pointer to "" is not skipped
// by omitempty.
type AccountSaveDto struct {
	Username   *string `json:"username" form:"username" validate:"required,validateStr"`
	Pass       *string `json:"pass" form:"pass" validate:"required,validateStr"`
	ConPass    *string `json:"conPass" form:"conPass" validate:"required,validateStr"`
	Quota      *int64  `json:"quota" form:"quota" validate:"required,min=-1"`
	ExpireTime *int64  `json:"expireTime" form:"expireTime" validate:"required,min=0"`
	DeviceNo   *int64  `json:"deviceNo" form:"deviceNo" validate:"required,min=1"`
	Deleted    *int64  `json:"deleted" form:"deleted" validate:"required,oneof=0 1"`
	Remark     *string `json:"remark" form:"remark" validate:"omitempty,max=50"`
}

// The dashboard posts every field on save, sending "" for credentials the
// administrator did not change, so optional strings must accept an empty value.
type AccountUpdateDto struct {
	IdDto
	Username   *string `json:"username" form:"username" validate:"omitempty,validateStr"`
	Pass       *string `json:"pass" form:"pass" validate:"omitempty,validateStr"`
	ConPass    *string `json:"conPass" form:"conPass" validate:"omitempty,validateStr"`
	Quota      *int64  `json:"quota" form:"quota" validate:"omitempty,min=-1"`
	ExpireTime *int64  `json:"expireTime" form:"expireTime" validate:"omitempty,min=0"`
	DeviceNo   *int64  `json:"deviceNo" form:"deviceNo" validate:"omitempty,min=1"`
	Deleted    *int64  `json:"deleted" form:"deleted" validate:"omitempty,oneof=0 1"`
	Remark     *string `json:"remark" form:"remark" validate:"omitempty,max=50"`
}
