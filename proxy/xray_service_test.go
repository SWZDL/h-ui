package proxy

import "testing"

func TestXrayArchiveName(t *testing.T) {
	tests := []struct {
		goos, goarch, want string
	}{
		{"linux", "amd64", "Xray-linux-64.zip"},
		{"linux", "arm64", "Xray-linux-arm64-v8a.zip"},
		{"linux", "arm", "Xray-linux-arm32-v7a.zip"},
		{"linux", "386", "Xray-linux-32.zip"},
	}
	for _, test := range tests {
		got, err := XrayArchiveName(test.goos, test.goarch)
		if err != nil {
			t.Errorf("XrayArchiveName(%q, %q): %v", test.goos, test.goarch, err)
			continue
		}
		if got != test.want {
			t.Errorf("XrayArchiveName(%q, %q) = %q; want %q", test.goos, test.goarch, got, test.want)
		}
	}
	if _, err := XrayArchiveName("darwin", "arm64"); err == nil {
		t.Fatal("expected unsupported operating system to fail")
	}
}
