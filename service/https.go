package service

import (
	"bufio"
	"crypto/tls"
	"net"
	"net/http"
	"sync"
	"time"
)

// redirectPlainHTTP never passes an unencrypted request to the panel or its API.
// Use the request authority, not forwarded headers, and keep the port, escaped
// path and query. Browsers also retain a SPA's fragment when following this URL.
func redirectPlainHTTP(handler http.Handler) http.Handler {
	if handler == nil {
		handler = http.DefaultServeMux
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS != nil {
			handler.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Connection", "close")
		if r.Host == "" {
			http.Error(w, "Host is required", http.StatusBadRequest)
			return
		}
		target := *r.URL
		target.Scheme, target.Host, target.User = "https", r.Host, nil
		w.Header().Set("Cache-Control", "no-store")
		http.Redirect(w, r, target.String(), http.StatusPermanentRedirect)
	})
}

type httpsAcceptResult struct {
	conn net.Conn
	raw  net.Conn
	err  error
}

// httpsListener lets one http.Server accept both TLS and plaintext on the panel
// port. Plaintext is only served by redirectPlainHTTP. Detection runs per
// connection so a client that sends no bytes cannot block other visitors.
// Returning concrete *tls.Conn values preserves net/http's HTTP/2 support.
type httpsListener struct {
	net.Listener
	config    *tls.Config
	ready     chan httpsAcceptResult
	done      chan struct{}
	startOnce sync.Once
	closeOnce sync.Once
	closeErr  error
	mu        sync.Mutex
	closed    bool
	pending   map[net.Conn]struct{}
}

func newHTTPSListener(listener net.Listener, config *tls.Config) *httpsListener {
	return &httpsListener{
		Listener: listener,
		config:   config,
		ready:    make(chan httpsAcceptResult),
		done:     make(chan struct{}),
		pending:  make(map[net.Conn]struct{}),
	}
}

func (l *httpsListener) Accept() (net.Conn, error) {
	// net/http configures ALPN before its first Accept; don't read the TLS
	// configuration concurrently with that setup.
	l.startOnce.Do(func() { go l.accept() })
	select {
	case result := <-l.ready:
		l.mu.Lock()
		delete(l.pending, result.raw)
		closed := l.closed
		l.mu.Unlock()
		if closed {
			return nil, net.ErrClosed
		}
		return result.conn, result.err
	case <-l.done:
		return nil, net.ErrClosed
	}
}

func (l *httpsListener) accept() {
	for {
		conn, err := l.Listener.Accept()
		if err != nil {
			select {
			case l.ready <- httpsAcceptResult{err: err}:
			case <-l.done:
				return
			}
			if temporary, ok := err.(net.Error); ok && temporary.Temporary() {
				continue
			}
			return
		}
		l.mu.Lock()
		if l.closed {
			l.mu.Unlock()
			_ = conn.Close()
			return
		}
		l.pending[conn] = struct{}{}
		l.mu.Unlock()
		go l.detect(conn)
	}
}

func (l *httpsListener) detect(raw net.Conn) {
	_ = raw.SetReadDeadline(time.Now().Add(10 * time.Second))
	reader := bufio.NewReader(raw)
	first, err := reader.Peek(1)
	if err == nil {
		_ = raw.SetReadDeadline(time.Time{})
		var conn net.Conn = &httpsBufferedConn{Conn: raw, reader: reader}
		if first[0] == 0x16 { // TLS handshake record
			conn = tls.Server(conn, l.config)
		}
		select {
		case l.ready <- httpsAcceptResult{conn: conn, raw: raw}:
			return // ownership transferred to Accept/net/http
		case <-l.done:
		}
	}
	_ = raw.Close()
	l.mu.Lock()
	delete(l.pending, raw)
	l.mu.Unlock()
}

func (l *httpsListener) Close() error {
	l.closeOnce.Do(func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		l.closed = true
		close(l.done)
		l.closeErr = l.Listener.Close()
		// These connections have not reached net/http yet, so Shutdown cannot
		// close them itself. Close also unblocks all detection goroutines.
		for conn := range l.pending {
			_ = conn.Close()
		}
	})
	return l.closeErr
}

type httpsBufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *httpsBufferedConn) Read(p []byte) (int, error) {
	return c.reader.Read(p)
}
