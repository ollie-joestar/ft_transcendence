#!/bin/sh
# vault/scripts/entrypoint.sh
# ---------------------------
# Wrapper for Vault startup.
# Modes:
# - dev mode: `vault server -dev` -> pass through without TLS generation
# - production mode: `vault server -config=...` -> ensure TLS files exist in /vault/tls

set -e

# Generate TLS only for production mode server startup.
# Agent and init containers consume certs and must not generate them.
if [ "${1:-}" = "server" ] && ! printf "%s " "$@" | grep -q -- "-dev"; then
	mkdir -p /vault/tls

	# Reuse existing files when present.
	if [ ! -s /vault/tls/ca.crt ] || [ ! -s /vault/tls/server.crt ] || [ ! -s /vault/tls/server.key ]; then
		TMP_DIR="$(mktemp -d)"
		trap 'rm -rf "$TMP_DIR"' EXIT

		# Create a local CA and a server certificate with SAN entries
		# for compose service name and loopback verification.
		openssl genrsa -out "$TMP_DIR/ca.key" 4096
		openssl req -x509 -new -nodes -key "$TMP_DIR/ca.key" -sha256 -days 3650 \
			-subj "/CN=transcendence-vault-ca" \
			-out /vault/tls/ca.crt

		openssl genrsa -out /vault/tls/server.key 4096
		openssl req -new -key /vault/tls/server.key -subj "/CN=vault" -out "$TMP_DIR/server.csr"

		cat > "$TMP_DIR/server.ext" <<EOF
subjectAltName=DNS:vault,DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
EOF

		openssl x509 -req -in "$TMP_DIR/server.csr" \
			-CA /vault/tls/ca.crt -CAkey "$TMP_DIR/ca.key" -CAcreateserial \
			-out /vault/tls/server.crt -days 825 -sha256 -extfile "$TMP_DIR/server.ext"

		chmod 600 /vault/tls/server.key
		chmod 644 /vault/tls/ca.crt /vault/tls/server.crt
	fi
fi

exec vault "$@"
