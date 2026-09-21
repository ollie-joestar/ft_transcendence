# vault/Dockerfile
# ----------------
# Adds OpenSSL support so TLS files can be generated inside the container at runtime
# and bundles bootstrap scripts for initialisation and secret seeding.
# This keeps runtime behaviour consistent and avoids long inline compose commands.

# Custom Vault image for production mode startup in compose
# Adds OpenSSL for runtime TLS generation and bundles shared scripts
FROM hashicorp/vault:latest
USER root
RUN apk add --no-cache openssl

# Keep script paths explicit and stable for compose references
COPY ./scripts/entrypoint.sh ./scripts/init-vault.sh /vault/scripts/
RUN chmod 755 /vault/scripts/entrypoint.sh /vault/scripts/init-vault.sh

# Wrapper entrypoint prepares TLS and then execs vault
ENTRYPOINT ["/bin/sh", "/vault/scripts/entrypoint.sh"]
