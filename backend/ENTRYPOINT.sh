#!/bin/sh
# What: Backend entrypoint sources Vault-rendered secrets before any
#       Prisma or Node process runs, ensuring DATABASE_URL is present
#       for migrations and JWT secrets for the NestJS JWT strategy.
# Why:  Prisma migrate deploy reads DATABASE_URL at invocation time.
#       NestJS JwtStrategy reads JWT_SECRET at module init time.
#       Both fail with undefined values if secrets are sourced too late.
# How:  Poll /secrets/backend.env (rendered by Vault Agent into shared
#       volume) with a timeout, source it to export all values into the
#       current shell environment, then exec into the normal startup flow.
set -e

SECRETS_FILE="/secrets/backend.env"

if [ "$NODE_ENV" = "prod" ]; then
	TIMEOUT=60
	ELAPSED=0
  echo "Running in production mode. Expecting secrets at $SECRETS_FILE..."
  echo "Waiting for Vault Agent to render secrets..."

  while [ ! -s "$SECRETS_FILE" ]; do   # the -s flag checks that the file exists and is non-empty.
	  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
		  echo "ERROR: $SECRETS_FILE not available after ${TIMEOUT}s — Vault Agent failed?"
		  exit 1
	  fi
	  sleep 1
	  ELAPSED=$((ELAPSED + 1))
  done

  # Load rendered secrets into current shell before starting app/migrations.
  echo "Sourcing secrets from $SECRETS_FILE..."
  . "$SECRETS_FILE"
  # Fail fast if required runtime vars are still missing after sourcing.
  [ -n "${JWT_SECRET:-}" ] || { echo "ERROR: JWT_SECRET missing after sourcing $SECRETS_FILE"; exit 1; }
  [ -n "${JWT_REFRESH_SECRET:-}" ] || { echo "ERROR: JWT_REFRESH_SECRET missing after sourcing $SECRETS_FILE"; exit 1; }
  [ -n "${DATABASE_URL:-}" ] || { echo "ERROR: DATABASE_URL missing after sourcing $SECRETS_FILE"; exit 1; }
  echo "Secrets loaded: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL"
else
  echo "Running in development mode. Expecting secrets in environment variables..."
  # Fail fast if required runtime vars are missing in development mode.
  [ -n "${JWT_SECRET:-}" ] || { echo "ERROR: JWT_SECRET missing from env"; exit 1; }
  [ -n "${JWT_REFRESH_SECRET:-}" ] || { echo "ERROR: JWT_REFRESH_SECRET missing from env"; exit 1; }
  [ -n "${DATABASE_URL:-}" ] || { echo "ERROR: DATABASE_URL missing from env"; exit 1; }
  echo "Secrets loaded: JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL"
fi

echo "Checking Prisma output..."
ls -la node_modules/.prisma/client || echo "Prisma client missing!!!"

echo "Running prisma migrations..."
if [ "$NODE_ENV" = "prod" ]; then
  echo "Running migrations in production mode..."
  npx prisma migrate deploy
else
  echo "Running migrations in development mode..."
  npx prisma migrate dev --name init
fi

echo "Prisma migrations completed."
echo "NODE_ENV: $NODE_ENV"

if [ "$NODE_ENV" = "prod" ]; then
  echo "Starting application in production mode..."
  exec npm run start:prod
else
  echo "Starting application in development mode..."
  exec npm run start:dev
fi
