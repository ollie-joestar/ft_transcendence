# vault/server.hcl
# ----------------
# Run Vault in production mode for local Docker Compose usage.
# This replaces `vault server -dev` and enables persistent storage.
#
# Why these settings
# - `ui = true` keeps the local web UI available for development workflows.
# - `disable_mlock = true` avoids mlock failures in common container runtimes.
# - `listener "tcp"` binds Vault API to port 8200 inside the compose network.
# - TLS is enabled with certs generated and mounted at /vault/tls.
# - `storage "file"` writes Vault state to /vault/data so data survives restarts.
# - `api_addr` sets the canonical service URL used by in-cluster clients.
#
# [Docs] https://developer.hashicorp.com/vault/docs/configuration

ui = true
disable_mlock = true

listener "tcp" {
  address = "0.0.0.0:8200"

  tls_disable = 0
  tls_cert_file = "/vault/tls/server.crt"
  tls_key_file = "/vault/tls/server.key"
}

storage "file" {
  path = "/vault/data"
}

api_addr = "https://vault:8200"
