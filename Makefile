NAME = transcendence

mode ?= dev

ifeq ($(filter prod, $(MAKECMDGOALS)),prod)
	NODE_ENV := prod
	mode = prod
endif

ifeq ($(filter dev, $(MAKECMDGOALS)),dev)
	NODE_ENV := dev
	mode = dev
endif

COMPOSE_PROD = docker compose -f docker-compose.yml --profile prod-only
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

ifeq ($(mode),prod)
	COMPOSE = ${COMPOSE_PROD}
else
	COMPOSE = ${COMPOSE_DEV}
endif

all: up

dev:
	@:

prod:
	@:

up:
# if not either prod or dev is specified, throw error
	@if [ -z "$(NODE_ENV)" ]; then \
		echo "Error: Please specify the environment (prod or dev)"; \
		exit 1; \
	fi
	@echo "Starting $(mode) environment..."
	@echo "Current node_env_mode: $(NODE_ENV)"
# add -d to silence docker compose output
	$(COMPOSE)  up --build

down:
	@echo "Stopping $(mode) environment..."
	$(COMPOSE) down -v

clean: down
	@echo "Removing containers for $(mode) environment..."
	$(COMPOSE) rm -f

fclean: down
	@echo "Removing containers and images for $(mode) environment..."
	$(COMPOSE) down --rmi all

re: fclean up

migrate:
	cd backend && npx prisma migrate dev --name init

help:
	@echo "Usage: make [target]"
	@echo "Targets:"
	@echo "  prod   - Build and run the production environment"
	@echo "  dev    - Build and run the development environment"
	@echo "  down   - Stop the running containers"
	@echo "  clean   - Stop and remove containers, but keep images"
	@echo "  fclean  - Stop and remove containers and images"
	@echo "  re      - Rebuild and restart the environment"
	@echo "  migrate - Run database migrations (development environment only)"
	@echo "  verify  - Verify Vault/Agent/backend/nginx secrets flow"

logs:
	$(COMPOSE_DEV) logs -f

logs-be:
	$(COMPOSE_DEV) logs -f backend

logs-fe:
	$(COMPOSE_DEV) logs -f frontend

logs-db:
	$(COMPOSE_DEV) logs -f db

logs-nginx:
	$(COMPOSE) logs -f nginx

verify:
	sh vault/scripts/verify-secrets-flow.sh

test-waf:
	sudo bash vault/scripts/waf-test-suite.sh

logs-waf:
	$(COMPOSE_PROD) logs nginx | grep "ModSecurity: Access denied" | sed 's/.*\[id "\([^"]*\)"\].*\[msg "\([^"]*\)"\].*\[uri "\([^"]*\)"\].*request: "\([^"]*\)".*/Rule: \1 | Msg: \2 | URI: \3 | Req: \4/'

.PHONY: all prod dev up down logs logs-be logs-fe logs-db logs-nginx clean fclean re verify test-waf logs-waf
