# vault/agent.hcl
# ---------------
# Vault Agent config for production mode bootstrap.
#
# - Agent authenticates to Vault and re-renders the secrets template on changes.
# - Agent uses the token file written by vault-init at /vault/bootstrap/root-token.
# - Rendered output is written to /secrets/backend.env for backend startup.
#
# [Docs] https://developer.hashicorp.com/vault/docs/agent-and-proxy/agent#configuration

pid_file = "/tmp/vault-agent.pid"

vault {
  address = "https://vault:8200"
  ca_cert = "/vault/tls/ca.crt"
}

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
