module github.com/ferg-cod3s/tunnelforge/go-server

go 1.23.0

toolchain go1.24.2

require (
	github.com/SherClockHolmes/webpush-go v1.4.0
	github.com/creack/pty v1.1.24
	github.com/getsentry/sentry-go v0.28.1
	github.com/golang-jwt/jwt/v5 v5.3.0
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.1
	github.com/rs/cors v1.10.1
	github.com/stretchr/testify v1.10.0
	golang.org/x/crypto v0.40.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	golang.org/x/net v0.41.0 // indirect
	golang.org/x/sys v0.34.0 // indirect
	golang.org/x/text v0.27.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/ferg-cod3s/tunnelforge/go-server => ./
