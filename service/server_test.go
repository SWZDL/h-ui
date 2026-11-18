package service

import (
	"net/http"
	"testing"
	"time"
)

func TestStartServerRejectsIncompleteOrInvalidCertificate(t *testing.T) {
	previous := server
	t.Cleanup(func() { server = previous })
	for _, paths := range [][2]string{{"missing.crt", ""}, {"", "missing.key"}, {"missing.crt", "missing.key"}} {
		InitServer("127.0.0.1:0", http.NotFoundHandler())
		done := make(chan error, 1)
		go func() { done <- StartServer(paths[0], paths[1]) }()
		select {
		case err := <-done:
			if err == nil {
				t.Fatalf("invalid certificate paths %q unexpectedly accepted", paths)
			}
		case <-time.After(time.Second):
			_ = server.Close()
			<-done
			t.Fatalf("invalid certificate paths %q started an HTTP server", paths)
		}
	}
}
