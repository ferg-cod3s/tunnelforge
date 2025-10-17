module github.com/ferg-cod3s/tunnelforge/go-server

go 1.24.0

toolchain go1.24.2

require (
	github.com/SherClockHolmes/webpush-go v1.4.0
	github.com/creack/pty v1.1.24
	github.com/getsentry/sentry-go v0.35.3
	github.com/golang-jwt/jwt/v5 v5.3.0
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.3
	github.com/joho/godotenv v1.5.1
	github.com/stretchr/testify v1.10.0
	golang.org/x/crypto v0.42.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
	golang.org/x/text v0.29.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/ferg-cod3s/tunnelforge/go-server => ./
