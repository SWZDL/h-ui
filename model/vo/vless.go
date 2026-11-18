package vo

type VlessSubscribeVo struct {
	Url    string `json:"url"`
	QrCode []byte `json:"qrCode"`
}

type VlessUrlVo struct {
	Url    string `json:"url"`
	QrCode []byte `json:"qrCode"`
}
