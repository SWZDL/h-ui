package dto

type VlessSubscribeUrlDto struct {
	AccountId *int64  `json:"accountId" form:"accountId" validate:"required,gt=0"`
	Protocol  *string `json:"protocol" form:"protocol" validate:"required,min=1,max=8"`
	Host      *string `json:"host" form:"host" validate:"required,min=1,max=301"`
}

type VlessUrlDto struct {
	AccountId *int64 `json:"accountId" form:"accountId" validate:"required,gt=0"`
}
