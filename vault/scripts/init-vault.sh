#!/bin/sh
# vault/scripts/init-vault.sh
# ---------------------------
# One shot bootstrap for Vault production mode in Docker Compose.
# This script waits for Vault readiness, initialises when required, unseals on restart,
# validates token state and seeds secret/backend for Vault Agent rendering.

set -e

# Vault API settings for in network TLS calls
export VAULT_ADDR="https://vault:8200"
export VAULT_CACERT="/vault/tls/ca.crt"

# Persistent bootstrap output location
INIT_FILE="/vault/bootstrap/init.txt"
mkdir -p /vault/bootstrap

# Wait until Vault API responds
STATUS_JSON=""
while [ -z "$STATUS_JSON" ]; do
	STATUS_JSON="$(vault status -format=json 2>/dev/null || true)"
	[ -n "$STATUS_JSON" ] || sleep 1
done

# Initialise only once
if echo "$STATUS_JSON" | grep -q '"initialized":[[:space:]]*false'; then
	vault operator init -key-shares=1 -key-threshold=1 > "$INIT_FILE"
	chmod 600 "$INIT_FILE"
fi

# Init file is required for unseal and token bootstrap
if [ ! -s "$INIT_FILE" ]; then
	echo "ERROR: $INIT_FILE missing. Vault already initialised but bootstrap file is unavailable."
	exit 1
fi

# Parse unseal key and root token from explicit fields
UNSEAL_KEY="$(awk -F': ' '/Unseal Key 1:/{print $2}' "$INIT_FILE")"
ROOT_TOKEN="$(awk -F': ' '/Initial Root Token:/{print $2}' "$INIT_FILE")"
[ -n "$UNSEAL_KEY" ] || { echo "ERROR: could not parse unseal key"; exit 1; }
[ -n "$ROOT_TOKEN" ] || { echo "ERROR: could not parse root token"; exit 1; }

# Unseal on restart when Vault is sealed
STATUS_JSON="$(vault status -format=json 2>/dev/null || true)"
if echo "$STATUS_JSON" | grep -q '"sealed":[[:space:]]*true'; then
	vault operator unseal "$UNSEAL_KEY" >/dev/null
fi

# Validate token and expose it for Vault Agent token_file auth
export VAULT_TOKEN="$ROOT_TOKEN"
if ! vault token lookup >/dev/null 2>&1; then
	echo "ERROR: stored root token in $INIT_FILE is invalid for current Vault data."
	exit 1
fi
printf "%s\n" "$ROOT_TOKEN" > /vault/bootstrap/root-token
chmod 600 /vault/bootstrap/root-token
# Ensure the expected KV v2 mount exists
if ! vault secrets list -format=json | grep -q '"secret/"'; then
	vault secrets enable -path=secret kv-v2 >/dev/null
fi

# Generate fresh keys and compose DATABASE_URL from root .env values
JWT_SECRET="$(vault write -field=random_bytes sys/tools/random bytes=32 format=hex)"
JWT_REFRESH_SECRET="$(vault write -field=random_bytes sys/tools/random bytes=32 format=hex)"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"

# Retry secret write to cover short settle windows after unseal
N=0
until vault kv put secret/backend \
	JWT_SECRET="$JWT_SECRET" \
	JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
	DATABASE_URL="$DATABASE_URL"; do
	N=$((N + 1))
	if [ "$N" -ge 10 ]; then
		echo "ERROR: failed to write secret/backend after $N attempts."
		exit 1
	fi
	sleep 1
done
