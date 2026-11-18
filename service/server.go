package service

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
	"h-ui/util"
)

var server *http.Server

func InitServer(addr string, handler http.Handler) {
	server = &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
}

func StartServer(crtPath string, keyPath string) error {
	if crtPath == "" && keyPath == "" {
		return server.ListenAndServe()
	}
	if crtPath == "" || keyPath == "" {
		return errors.New("HTTPS requires both a certificate and a private key")
	}
	certificate, err := tls.LoadX509KeyPair(crtPath, keyPath)
	if err != nil {
		return fmt.Errorf("load panel HTTPS certificate: %w", err)
	}
	server.TLSConfig = &tls.Config{
		Certificates: []tls.Certificate{certificate},
		MinVersion:   tls.VersionTLS12,
		NextProtos:   []string{"h2", "http/1.1"},
	}
	server.Handler = redirectPlainHTTP(server.Handler)
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return err
	}
	return server.Serve(newHTTPSListener(listener, server.TLSConfig))
}

func StopServer() error {
	if err := StopHysteria2(); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logrus.Errorf("failed to shutdown server: %v", err)
		return errors.New("failed to shutdown server")
	}

	return nil
}

func GetServerPortAndCert() (int64, string, string, error) {
	port, crtPath, keyPath, err := GetPortAndCert()
	if err != nil {
		return 0, "", "", err
	}

	if !util.IsPortAvailable(uint(port), "tcp") {
		errMsg := fmt.Sprintf("port %d is taken", port)
		logrus.Errorf(errMsg)
		return 0, "", "", errors.New(errMsg)
	}

	if crtPath != "" && !util.Exists(crtPath) {
		errMsg := fmt.Sprintf("crt path: %s does not exist", crtPath)
		logrus.Errorf(errMsg)
		return 0, "", "", errors.New(errMsg)
	}

	if keyPath != "" && !util.Exists(keyPath) {
		errMsg := fmt.Sprintf("key path: %s does not exist", keyPath)
		logrus.Errorf(errMsg)
		return 0, "", "", errors.New(errMsg)
	}

	return port, crtPath, keyPath, nil
}
