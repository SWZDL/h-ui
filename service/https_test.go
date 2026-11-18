package service

import (
	"context"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRedirectPlainHTTP(t *testing.T) {
	tests := []struct {
		name, method, target, host, want string
	}{
		{"root", "GET", "/", "panel.example:8099", "https://panel.example:8099/"},
		{"subpath", "GET", "/panel/?focus=huiHttps", "panel.example:8099", "https://panel.example:8099/panel/?focus=huiHttps"},
		{"escaped-path", "GET", "/panel/a%2Fb?token=a%2Bb&x=1", "panel.example:8099", "https://panel.example:8099/panel/a%2Fb?token=a%2Bb&x=1"},
		{"ipv6", "HEAD", "/panel/", "[::1]:8099", "https://[::1]:8099/panel/"},
		{"post", "POST", "/hui/auth/login", "panel.example:8099", "https://panel.example:8099/hui/auth/login"},
		{"double-slash", "GET", "//other.example/path", "panel.example:8099", "https://panel.example:8099//other.example/path"},
		{"absolute-form", "GET", "http://other.example/path?x=1", "panel.example:8099", "https://panel.example:8099/path?x=1"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handler := redirectPlainHTTP(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Error("plaintext request reached the application")
			}))
			req := httptest.NewRequest(test.method, test.target, nil)
			req.Host = test.host
			// Untrusted proxy headers must not bypass HTTPS enforcement.
			req.Header.Set("X-Forwarded-Proto", "https")
			req.Header.Set("X-Forwarded-Host", "other.example")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != http.StatusPermanentRedirect || response.Header().Get("Location") != test.want {
				t.Fatalf("got %d Location=%q; want 308 %q", response.Code, response.Header().Get("Location"), test.want)
			}
		})
	}
}

func TestRedirectPlainHTTPRequiresHost(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = ""
	response := httptest.NewRecorder()
	redirectPlainHTTP(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("plaintext request reached the application")
	})).ServeHTTP(response, req)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("got %d; want 400", response.Code)
	}
}

func TestHTTPSListenerRedirectsAndServesTLS(t *testing.T) {
	// Reuse httptest's locally trusted certificate without skipping verification.
	seed := httptest.NewTLSServer(http.NotFoundHandler())
	config := seed.TLS.Clone()
	clientConfig := seed.Client().Transport.(*http.Transport).TLSClientConfig.Clone()
	seed.Close()
	config.NextProtos = []string{"h2", "http/1.1"}

	rawListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	listener := newHTTPSListener(rawListener, config)
	var calls atomic.Int32
	web := &http.Server{
		TLSConfig:         config,
		ReadHeaderTimeout: 2 * time.Second,
		Handler: redirectPlainHTTP(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			if r.TLS == nil {
				t.Error("plaintext request reached the application")
			}
			body, _ := io.ReadAll(r.Body)
			_, _ = io.WriteString(w, r.Method+" "+r.RequestURI+" "+string(body))
		})),
	}
	done := make(chan error, 1)
	go func() { done <- web.Serve(listener) }()
	t.Cleanup(func() {
		_ = web.Close()
		select {
		case err := <-done:
			if !errors.Is(err, http.ErrServerClosed) {
				t.Errorf("Serve returned %v", err)
			}
		case <-time.After(3 * time.Second):
			t.Error("Serve did not exit after closing the listener")
		}
	})

	// A slow/idle client must not stall the accept loop or subsequent TLS calls.
	idle, err := net.Dial("tcp", rawListener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer idle.Close()
	deadline := time.Now().Add(3 * time.Second)
	for {
		listener.mu.Lock()
		pending := len(listener.pending)
		listener.mu.Unlock()
		if pending > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("idle connection was not accepted")
		}
		time.Sleep(time.Millisecond)
	}

	plainTransport := &http.Transport{}
	defer plainTransport.CloseIdleConnections()
	plain := &http.Client{
		Transport: plainTransport,
		Timeout:   3 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	path := "/panel/a%2Fb?x=a%2Bb"
	response, err := plain.Get("http://" + rawListener.Addr().String() + path)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	wantLocation := "https://" + rawListener.Addr().String() + path
	if response.StatusCode != 308 || response.Header.Get("Location") != wantLocation {
		t.Fatalf("got %d Location=%q; want 308 %q", response.StatusCode, response.Header.Get("Location"), wantLocation)
	}
	if calls.Load() != 0 {
		t.Fatal("plaintext redirect invoked the application")
	}

	for _, version := range []uint16{tls.VersionTLS12, tls.VersionTLS13} {
		for _, http2 := range []bool{false, true} {
			clientTLS := clientConfig.Clone()
			clientTLS.MinVersion, clientTLS.MaxVersion = version, version
			transport := &http.Transport{TLSClientConfig: clientTLS, ForceAttemptHTTP2: http2}
			defer transport.CloseIdleConnections()
			client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
			for i := 0; i < 2; i++ { // also exercise keep-alive and buffered reads
				response, err := client.Post(wantLocation, "text/plain", strings.NewReader("payload"))
				if err != nil {
					t.Fatal(err)
				}
				body, _ := io.ReadAll(response.Body)
				_ = response.Body.Close()
				wantProto := 1
				if http2 {
					wantProto = 2
				}
				if response.StatusCode != 200 || response.ProtoMajor != wantProto || string(body) != "POST "+path+" payload" {
					t.Fatalf("TLS %x: got %s %d %q; want HTTP/%d 200 with original request", version, response.Proto, response.StatusCode, body, wantProto)
				}
			}
		}
	}
	if calls.Load() != 8 {
		t.Fatalf("application received %d requests; want 8", calls.Load())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := web.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	_ = idle.SetReadDeadline(time.Now().Add(time.Second))
	if _, err := idle.Read(make([]byte, 1)); !errors.Is(err, io.EOF) {
		t.Fatalf("idle connection not closed by shutdown: %v", err)
	}
}
