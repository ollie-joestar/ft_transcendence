#!/bin/sh
# vault/scripts/verify-secrets-flow.sh
# ------------------------------------
# End-to-end verification for Vault -> Vault Agent -> backend secret flow
# and nginx HTTPS health routing.

set -e

YELLOW="$(printf '\033[33m')"
RED="$(printf '\033[31m')"
GREEN="$(printf '\033[32m')"
RESET="$(printf '\033[0m')"

# Auto-detect whether Docker requires sudo on this machine.
USE_SUDO=0
if ! docker info >/dev/null 2>&1; then
	USE_SUDO=1
fi

if [ "$USE_SUDO" -eq 1 ]; then
	if ! command -v sudo >/dev/null 2>&1; then
		echo "ERROR: docker requires elevated privileges and sudo is not available." >&2
		exit 1
	fi
	# Ask once up front so the script doesn't fail midway on a password prompt.
	sudo -v
fi

d() {
	# Wrapper for docker commands (with/without sudo).
	if [ "$USE_SUDO" -eq 1 ]; then
		sudo docker "$@"
	else
		docker "$@"
	fi
}

dc() {
	# Wrapper for docker compose subcommands.
	# Enable prod-only profile so vault services show in config output.
	d compose --profile prod-only "$@"
}

step() {
	printf "%s==> %s%s\n" "$YELLOW" "$1" "$RESET"
}

fail() {
	# On failure, print targeted service logs for quick diagnosis.
	printf "%sERROR: %s%s\n" "$RED" "$1" "$RESET" >&2
	echo "--- vault-init logs (tail 80) ---" >&2
	dc logs vault-init --tail=80 >&2 || true
	echo "--- vault-agent logs (tail 120) ---" >&2
	dc logs vault-agent --tail=120 >&2 || true
	echo "--- backend logs (tail 120) ---" >&2
	dc logs backend --tail=120 >&2 || true
	exit 1
}

# Ensure backend and vault images include latest startup scripts before checks.
step "Building backend and vault images to ensure latest startup scripts are used"
dc build backend vault

# Recreate only services involved in secrets flow + edge health path.
# Note Include db so backend health can complete
# Note Include frontend so nginx upstream resolves
step "Recreating vault backend nginx frontend db services"
if ! dc up -d --force-recreate --no-deps vault vault-init vault-agent backend nginx db frontend; then
	fail "docker compose up failed while recreating vault and backend flow services"
fi

# Config correctness check: backend must not depend on backend/.env, and vault-init must use root .env.
step "Check 1/10: compose wiring has no backend/.env coupling"
COMPOSE_BACKEND_BLOCK="$(dc config | awk '/^  backend:/{flag=1;next}/^  [a-zA-Z0-9_-]+:/{if(flag){exit}}flag{print}')"
COMPOSE_VAULT_INIT_BLOCK="$(dc config | awk '/^  vault-init:/{flag=1;next}/^  [a-zA-Z0-9_-]+:/{if(flag){exit}}flag{print}')"
COMPOSE_VAULT_BLOCK="$(dc config | awk '/^  vault:/{flag=1;next}/^  [a-zA-Z0-9_-]+:/{if(flag){exit}}flag{print}')"

if printf "%s\n" "$COMPOSE_BACKEND_BLOCK" | grep -q "env_file:"; then
	fail "backend still declares env_file in compose config"
fi
if printf "%s\n" "$COMPOSE_BACKEND_BLOCK" | grep -q "DATABASE_URL:"; then
	fail "backend still declares DATABASE_URL directly in compose config"
fi
if printf "%s\n" "$COMPOSE_VAULT_INIT_BLOCK" | grep -q "env_file:"; then
	if ! printf "%s\n" "$COMPOSE_VAULT_INIT_BLOCK" | grep -q "\.env"; then
		fail "vault-init env_file does not include root .env for POSTGRES_* values"
	fi
else
	if ! printf "%s\n" "$COMPOSE_VAULT_INIT_BLOCK" | grep -q "POSTGRES_USER:"; then
		fail "vault-init does not expose POSTGRES_* values from root .env in compose config"
	fi
fi

# Vault baseline: production mode server config + persistent storage + TLS transport.
step "Check 2/10: vault runs production mode config with persistent storage and TLS"
if ! printf "%s\n" "$COMPOSE_VAULT_BLOCK" | grep -q -- "-config=/vault/server.hcl"; then
	fail "vault command does not use /vault/server.hcl"
fi
if printf "%s\n" "$COMPOSE_VAULT_BLOCK" | grep -q -- "-dev"; then
	fail "vault command still contains -dev flags"
fi
if ! printf "%s\n" "$COMPOSE_VAULT_BLOCK" | grep -q "/vault/data"; then
	fail "vault persistent /vault/data volume is not configured"
fi
if ! printf "%s\n" "$COMPOSE_VAULT_BLOCK" | grep -q "VAULT_ADDR: https://0.0.0.0:8200"; then
	fail "vault compose env does not use https VAULT_ADDR"
fi
if ! printf "%s\n" "$COMPOSE_VAULT_BLOCK" | grep -q "/vault/tls/ca.crt"; then
	fail "vault compose env does not set VAULT_CACERT to /vault/tls/ca.crt"
fi

# Vault TLS transport checks.
step "Check 3/10: vault TLS endpoint is trusted and plaintext HTTP is rejected"
CA_FILE="$(mktemp)"
trap 'rm -f "$CA_FILE"' EXIT
if ! d exec vault sh -lc 'test -s /vault/tls/ca.crt && cat /vault/tls/ca.crt' > "$CA_FILE"; then
	fail "vault TLS CA certificate is not available in /vault/tls/ca.crt"
fi
if ! curl --cacert "$CA_FILE" -fsS https://127.0.0.1:8200/v1/sys/health > /dev/null; then
	fail "vault TLS endpoint did not respond with configured CA trust"
fi
if curl -fsS http://127.0.0.1:8200/v1/sys/health > /dev/null 2>&1; then
	fail "vault accepted plaintext HTTP on port 8200"
fi

# vault-init must seed secret/backend in Vault.
step "Check 4/10: vault-init wrote secret/backend"
if ! dc logs vault-init --tail=80 | grep -q "Secret Path"; then
	fail "vault-init output does not show secret write result"
fi

# vault-agent must render Vault values into /secrets/backend.env.
step "Check 5/10: vault-agent rendered /secrets/backend.env"
I=0
RENDERED=0
while [ "$I" -lt 30 ]; do
	AGENT_LOGS="$(dc logs vault-agent --tail=200 || true)"
	if printf "%s\n" "$AGENT_LOGS" | grep -q "invalid token"; then
		fail "vault-agent failed authentication with invalid token"
	fi
	if printf "%s\n" "$AGENT_LOGS" | grep -q 'rendered "/vault/backend.env.ctmpl" => "/secrets/backend.env"'; then
		RENDERED=1
		break
	fi
	sleep 1
	I=$((I + 1))
done
if [ "$RENDERED" -ne 1 ]; then
	fail "vault-agent did not render backend.env"
fi

# backend must see the rendered file through the shared read-only mount.
step "Check 6/10: rendered file exists and is non-empty in backend"
if ! d exec backend sh -lc 'test -s /secrets/backend.env'; then
	fail "backend does not have non-empty /secrets/backend.env"
fi

# Confirms backend container is running updated ENTRYPOINT secret loading logic.
step "Check 7/10: backend is running updated ENTRYPOINT secrets checks"
if ! dc logs backend --tail=120 | grep -q "Secrets loaded: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL"; then
	fail "backend logs do not show updated ENTRYPOINT secret-load confirmation (stale image?)"
fi

# Wait for backend startup before asserting process environment.
step "Check 8/10: backend health is ready before env assertions"
READY=0
I=0
while [ "$I" -lt 60 ]; do
	if d exec backend sh -lc 'curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1'; then
		READY=1
		break
	fi
	sleep 1
	I=$((I + 1))
done
if [ "$READY" -ne 1 ]; then
	fail "backend /health did not become ready within 60s"
fi

# Process-level env check: verifies sourced secrets were inherited by Node process.
step "Check 9/10: backend process env contains required variables"
if ! d exec backend sh -lc 'tr "\0" "\n" < /proc/1/environ | grep -q "^JWT_SECRET="'; then
	fail "JWT_SECRET missing from backend process environment"
fi
if ! d exec backend sh -lc 'tr "\0" "\n" < /proc/1/environ | grep -q "^JWT_REFRESH_SECRET="'; then
	fail "JWT_REFRESH_SECRET missing from backend process environment"
fi
if ! d exec backend sh -lc 'tr "\0" "\n" < /proc/1/environ | grep -q "^DATABASE_URL="'; then
	fail "DATABASE_URL missing from backend process environment"
fi

# End-to-end edge check through HTTPS ingress.
# Note Allow nginx time to present TLS
step "Check 10/10: HTTPS health endpoint returns 200"
READY=0
I=0
while [ "$I" -lt 30 ]; do
	if curl -kfsS https://127.0.0.1:8443/health > /dev/null; then
		READY=1
		break
	fi
	sleep 1
	I=$((I + 1))
done
if [ "$READY" -ne 1 ]; then
	fail "https://127.0.0.1:8443/health failed"
fi

printf "%sOK: Secrets flow verification passed.%s\n" "$GREEN" "$RESET"
