# Security Architecture: Vault + ModSecurity/WAF

**For evaluators:** This document explains how secrets are managed, how the WAF protects the edge, and how to verify the security posture.

---

## Overview

The ft_transcendence security setup has two independent layers:

1. **Vault-based secrets management** (backend data layer)
   - Vault stores encrypted secrets in persistent storage.
   - Vault Agent renders secrets into a shared volume that the backend mounts read-only.
   - Backend never talks directly to Vault; it only reads rendered environment files.

2. **ModSecurity/WAF hardening** (network edge layer)
   - Nginx + ModSecurity acts as reverse proxy with OWASP CRS rules at Paranoia Level 1.
   - All inbound HTTP/HTTPS traffic passes through the WAF before reaching the backend.
   - Blocked requests are logged with rule IDs for evidence.

Both layers operate independently: Vault provides secret isolation; WAF provides attack prevention.

---

## Vault Secret Bootstrap

**Startup sequence:**

```
1. docker-compose up (prod-only profile)
   ├─ vault service: starts, reads /vault/server.hcl (production mode, file storage)
   ├─ vault-init: waits for vault API readiness, then runs init-vault.sh:
   │  ├─ Initialize Vault once (persisted in /vault/bootstrap/init.txt)
   │  ├─ Unseal on restart (using key from init.txt)
   │  ├─ Write root token to /vault/bootstrap/root-token
   │  ├─ Enable kv-v2 secret engine if needed
   │  └─ Seed secret/backend with JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL
   └─ vault-agent: waits for vault-init to complete, then:
      ├─ Auth to Vault using /vault/bootstrap/root-token (token_file method)
      └─ Render /vault/backend.env.ctmpl → /secrets/backend.env
```

**File ownership and permissions:**
- **Root user**: vault, vault-init, vault-agent all run as `user: "0:0"` because `/vault/data` (persistent storage) and `/vault/tls` (TLS material) are local named volumes that require root write permission.
- **Capabilities dropped**: `cap_drop: [ALL]` + `security_opt: [no-new-privileges:true]` significantly reduce blast radius if a container is compromised.
- **Specific capability**: only vault service has `IPC_LOCK` (required by Vault for secure memory locking).

---

## Secret Boundaries

| Layer | Component | Secret Source | Secret Form | Ownership |
|-------|-----------|---|---|---|
| **Generation** | vault-init | `vault write sys/tools/random bytes=32` | Hex-encoded 32-byte random | root (vault-init) |
| **Storage** | Vault | `/vault/data` (encrypted on disk) | KV v2 entry in `secret/backend` | root (vault service) |
| **Rendering** | vault-agent | Template + KV read | Plaintext env vars in `/secrets/backend.env` | root (vault-agent) |
| **Consumption** | backend | Read-only mount of `/secrets` | Sourced into shell environment | node (backend app) |

**Key invariants:**
- Backend **never reads from Vault directly**; it has no `VAULT_ADDR` or token.
- Backend **never has env_file: .env coupling**; secrets come solely from `/secrets/backend.env` (rendered by Agent).
- Vault **never exposes raw root token** to non-init services (only `vault-agent` reads the token file).

---

## Vault Infrastructure

### Vault Server (`vault` service)

**Config**: `/vault/server.hcl`
```hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/tls/server.crt"
  tls_key_file  = "/vault/tls/server.key"
}

storage "file" {
  path = "/vault/data"
}
```

**Why production mode?**
- Enforces TLS for all API calls (no `-dev` flag).
- Persists state to `/vault/data` (survives restarts).
- Requires unsealing on restart (security feature: keys must be provided explicitly).

**TLS Material:**
- Generated at runtime by vault's entrypoint wrapper (`vault/scripts/entrypoint.sh`).
- Self-signed cert + CA bundle stored in `/vault/tls/` (shared volume).
- All Vault clients use `VAULT_CACERT=/vault/tls/ca.crt` for verification.

### Vault-Init Bootstrap

**Script**: `vault/scripts/init-vault.sh`

1. Wait for Vault API readiness (poll `vault status -format=json`).
2. If not initialized, run `vault operator init -key-shares=1 -key-threshold=1` and save result to `/vault/bootstrap/init.txt`.
3. Parse unseal key and root token from init.txt.
4. Unseal: `vault operator unseal <key>`.
5. Validate root token: `vault token lookup` (fails if data was reset externally).
6. Write root token to `/vault/bootstrap/root-token` (readable by vault-agent).
7. Enable kv-v2 secret engine: `vault secrets enable -path=secret kv-v2`.
8. Generate fresh secrets: `JWT_SECRET=$(vault write -field=random_bytes sys/tools/random bytes=32 format=hex)` (same for JWT_REFRESH_SECRET).
9. Construct DATABASE_URL from root `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, etc.).
10. Write all three to `secret/backend`: `vault kv put secret/backend JWT_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=...`.

**Why this order?**
- Unsealing must happen before secret operations (sealed Vault rejects all KV writes).
- Root token validation ensures the stored init.txt is still valid for the current Vault data (guards against external resets).
- Secret seeding happens once per init (persisted in Vault storage; safe to re-run if the secret already exists).

### Vault Agent (`vault-agent` service)

**Config**: `/vault/agent.hcl`
```hcl
auto_auth {
  method "token_file" {
    config = {
      token_file_path = "/vault/bootstrap/root-token"
    }
  }
}

template {
  source      = "/vault/backend.env.ctmpl"
  destination = "/secrets/backend.env"
  perms       = 0640
}
```

**Why token_file instead of AppRole?**
- Simpler for local compose flow (no role provisioning, no secret rotation).
- Root token is already generated and isolated in `/vault/bootstrap/root-token` (readable only by vault-agent).
- For production, AppRole would be more appropriate (subject to future hardening).

**Template file**: `/vault/backend.env.ctmpl`
```
export JWT_SECRET={{ with secret "secret/data/backend" }}{{ .Data.data.JWT_SECRET }}{{ end }}
export JWT_REFRESH_SECRET={{ with secret "secret/data/backend" }}{{ .Data.data.JWT_REFRESH_SECRET }}{{ end }}
export DATABASE_URL={{ with secret "secret/data/backend" }}{{ .Data.data.DATABASE_URL }}{{ end }}
```

**Rendering happens:**
- On Agent startup (after token is read and validated).
- Automatically if the secret changes (Agent watches the secret path).
- Output is written to `/secrets/backend.env` with mode `0640` (read+write owner, read group, no other access).

### Backend Integration

**Backend service** mounts the secret volume:
```yaml
volumes:
  - secrets_vol:/secrets:ro  # read-only
```

**Startup (in `ENTRYPOINT.sh`):**
```bash
if [ -f /secrets/backend.env ]; then
  source /secrets/backend.env
else
  echo "ERROR: /secrets/backend.env not found"
  exit 1
fi
```

**Why read-only mount?**
- Backend cannot modify rendered secrets (prevents accidental leaks).
- Vault Agent has exclusive write access (enforced by volume mount permissions).

---

## WAF Edge Hardening

### Nginx + ModSecurity

**Image**: `owasp/modsecurity-crs:nginx-alpine`
- Comes with OWASP CRS (Core Rule Set) pre-installed.
- ModSecurity module compiled into Nginx.

**Paranoia Level**: **PL1** (baseline security, suitable for game/social platform)
```yaml
environment:
  PARANOIA: 1
  ANOMALY_INBOUND: 2       # Tuned to balance blocking attacks vs false positives
  ANOMALY_OUTBOUND: 2
  BLOCKING_PARANOIA: 1
```

**What PL1 includes:**
- Core attack patterns: SQLi, XSS, path traversal, command injection, etc.
- Protocol anomaly detection (missing/invalid headers, malformed requests).
- Approximately 1,000–2,000 active rules focused on common exploits.
- Lower false-positive rate suitable for gaming/social platforms.

**Anomaly thresholds (ANOMALY_INBOUND=2):**
- Rules assign anomaly scores to suspicious patterns
- Request is blocked if score ≥ threshold
- Threshold=2 allows minor rule matches (normal variation) but blocks serious attacks
- Threshold=1 is too strict (blocks legitimate traffic like clean parameters)

### TLS Transport

**Port binding**: `127.0.0.1:8443:8443` (localhost-only HTTPS)
- Suitable for local dev/testing; production would expose differently.

**Certificate and key**:
- Generated by Nginx/ModSecurity image at startup.
- Stored in `/etc/nginx/conf/server.crt` and `/etc/nginx/conf/server.key`.

**Health check**:
```bash
curl -k -f https://127.0.0.1:8443/health
```
The `-k` flag trusts self-signed certificates for local testing.

### Reverse Proxy Configuration

**Upstream**: `backend:3000` (backend service on app_network)
**Proxy path**: all requests to the backend
**Logging**: audit logs in JSON format (`MODSEC_AUDIT_LOG_FORMAT: JSON`)

WAF decision per request:
1. Receive inbound request.
2. Apply CRS rules (PL1 rule set, 1k–2k rules focused on common exploits).
3. If anomaly score exceeds threshold (ANOMALY_INBOUND=2), block request → 403 Forbidden.
4. Otherwise, proxy to backend → 200 OK (if backend succeeds).
5. Log: request, response code, rule IDs triggered (if any).

---

## Security Boundaries (Trust Zones)

```
┌─────────────────────────────────────────────────────────────┐
│ Public Internet                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS :8443 (TLS)
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Nginx (OWASP WAF, ModSecurity CRS PL1)                     │
│ - Blocks malicious payloads (SQLi, XSS, etc.)             │
│ - Logs rule IDs and blocked requests                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP :3000 (app_network, trusted)
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Backend (Node.js + Prisma)                                 │
│ - Mounts /secrets read-only                                │
│ - Sources environment from /secrets/backend.env            │
│ - Connects to PostgreSQL via DATABASE_URL                 │
└────────────────────────┬────────────────────────────────────┘
                         │ TCP :5432 (app_network, trusted)
                         │
┌────────────────────────▼────────────────────────────────────┐
│ PostgreSQL Database                                         │
│ - Accessed only via backend (no direct external access)    │
└─────────────────────────────────────────────────────────────┘
```

**Vault (separate trust zone):**
```
┌──────────────────────────────────────────────────────────┐
│ Vault (HTTPS :8200, TLS, persistent /vault/data)        │
│ - Initialized once via vault-init bootstrap              │
│ - Sealed on restart (requires unseal key)                │
│ - Accessed only by vault-agent + vault-init              │
│ - Backend does NOT reach Vault directly                  │
└──────────────────────────────────────────────────────────┘
```

**Key principle:** Backend and Vault do not have direct network paths; secrets flow only through Vault Agent's template rendering.

---

## Runtime Ownership & Capabilities

### Why root (`user: "0:0"`)?

Local named volumes (`/vault/data`, `/vault/tls`, `/secrets`) are owned by host root. Only root inside containers can write to them.

| Service | Runs as | Volumes | Rationale |
|---------|---------|---------|-----------|
| vault | root | `/vault/data` (r/w), `/vault/tls` (w) | Storage and TLS material generation |
| vault-init | root | `/vault/bootstrap` (w), `/vault/tls` (r) | Init file and token file writes |
| vault-agent | root | `/secrets` (w), `/vault/bootstrap` (r) | Render secrets, read token file |
| backend | node | `/secrets` (r) | Consume rendered secrets |
| nginx | nginx | — | No volume writes; proxy only |

### Capability Hardening

All Vault services drop all capabilities (`cap_drop: [ALL]`) except:
- **vault only**: `cap_add: [IPC_LOCK]` — required by Vault for secure memory locking.

```yaml
cap_drop:
  - ALL
cap_add:
  - IPC_LOCK  # vault only
security_opt:
  - no-new-privileges:true  # all vault services
```

**Effect:**
- Process cannot escalate privileges (`no-new-privileges`).
- Cannot gain new capabilities at runtime (child processes inherit no caps).
- Even if container is compromised, attacker cannot break out to host (e.g., no `CAP_SETFCAP`, no `CAP_SYS_ADMIN`).

---

## Verification Checklist (for Evaluators)

### 1. Vault is running in production mode
```bash
docker compose -p transcendence --profile prod-only exec vault vault status
```
**Expected output:**
- `Sealed: false` (after unsealing)
- `Storage Type: file`
- `Version: 2.x.x`

### 2. Secret is seeded in Vault
```bash
docker compose -p transcendence --profile prod-only exec -e VAULT_ADDR=https://vault:8200 \
  -e VAULT_CACERT=/vault/tls/ca.crt vault \
  vault kv get secret/backend
```
**Expected output:**
```
====== Data ======
Key                 Value
---                 -----
DATABASE_URL        postgresql://...
JWT_REFRESH_SECRET  abcdef... (hex)
JWT_SECRET          abcdef... (hex)
```

### 3. Vault Agent rendered the secret file
```bash
docker compose -p transcendence --profile prod-only exec backend cat /secrets/backend.env
```
**Expected output:**
```
export JWT_SECRET=abcdef...
export JWT_REFRESH_SECRET=abcdef...
export DATABASE_URL=postgresql://...
```

### 4. Backend sourced the secrets
```bash
docker compose -p transcendence --profile prod-only logs backend | grep "Secrets loaded"
```
**Expected output:**
```
Secrets loaded: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL
```

### 5. WAF is active and blocks attacks
Run the WAF test suite (see `#46`):
```bash
sudo bash vault/scripts/waf-test-suite.sh
```
**Expected output:**
- Table of test cases with response codes and rule IDs.
- Blocked cases: 403 (or 429 if rate-limited) with rule ID.
- Allowed cases: 200 with no rule ID.

### 6. Nginx forwards allowed traffic
```bash
curl -k https://127.0.0.1:8443/health
```
**Expected output:** `200 OK` (or appropriate backend response).

### 7. TLS is enforced
```bash
curl http://127.0.0.1:8443/health 2>&1 | head -5
```
**Expected output:** Connection refused or timeout (plaintext HTTP rejected).

---

## Comments in Config Files

**Where to look for additional detail:**
- `docker-compose.yml` (lines 31–35): WAF paranoia levels
- `docker-compose.yml` (lines 75–107): Vault service and bootstrap flow
- `docker-compose.yml` (lines 114–135): vault-init entrypoint and env_file coupling
- `docker-compose.yml` (lines 137–191): Vault Agent auth and template rendering
- `vault/server.hcl`: Vault storage and listener configuration
- `vault/agent.hcl`: Token auth and template destination
- `vault/scripts/init-vault.sh`: Step-by-step bootstrap logic
- `vault/scripts/entrypoint.sh`: Runtime TLS certificate generation

All comments focus on **why** (security rationale) rather than **what** (code behavior).

---
