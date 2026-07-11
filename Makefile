# DataShield developer tasks. Thin wrapper over the npm scripts and
# scripts/db-init.sh so a fresh clone can be brought up with a single command.
# Requires Node 22 and (for the local database) Docker.

.DEFAULT_GOAL := help
SHELL := /bin/sh

# Run npm/npx under the project's Node version (.nvmrc) via nvm when available,
# so the targets work even when the shell's default Node is wrong.
N := sh scripts/use-node.sh

.PHONY: help
help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: install env db-init ## One-shot: install deps, create .env.local, start DB, migrate, seed
	@echo "Setup complete. Start the app with 'make run'."

.PHONY: install
install: ## Install dependencies (also runs prisma generate)
	$(N) npm install

.PHONY: env
env: ## Create .env.local from .env.example with generated secrets (no-op if it exists)
	@sh scripts/env-init.sh

.PHONY: db-up
db-up: ## Start the local PostgreSQL container
	$(N) npm run db:up

.PHONY: db-down
db-down: ## Stop the local database container
	$(N) npm run db:down

.PHONY: db-init
db-init: ## Start DB, apply migrations, seed demo data (Docker required)
	$(N) npm run db:init

.PHONY: backup
backup: ## Dump the local database to backups/ (pg_dump)
	$(N) npm run db:backup

.PHONY: restore
restore: ## Restore a dump (destructive): make restore FILE=backups/<file>.dump
	$(N) npm run db:restore -- "$(FILE)"

.PHONY: migrate
migrate: ## Apply pending Prisma migrations
	$(N) npm run db:migrate

.PHONY: seed
seed: ## Seed the base admin account
	$(N) npm run seed

.PHONY: seed-dev
seed-dev: ## Seed demo data for development
	$(N) npm run seed:dev

.PHONY: run
run: ## Run the dev server
	$(N) npm run dev

.PHONY: build
build: ## Production build
	$(N) npm run build

.PHONY: lint
lint: ## Lint
	$(N) npm run lint

.PHONY: lint-fix
lint-fix: ## Lint and auto-fix
	$(N) npm run lint:fix

.PHONY: test
test: ## Run the test suite
	$(N) npm test

.PHONY: e2e
e2e: ## Run the Playwright smoke test (app must be reachable on :3000)
	$(N) npm run test:e2e

.PHONY: check
check: ## Run the same gates CI enforces (lint, types, schema, build)
	$(N) npm run lint -- --max-warnings 0
	$(N) npx tsc --noEmit
	$(N) npx prisma validate
	$(N) npm run build

.PHONY: doctor
doctor: ## Full setup diagnosis with optional auto-fix (toolchain, env, Docker, DB, Prisma)
	@sh scripts/doctor.sh

.PHONY: clean
clean: ## Stop the DB and remove node_modules and the Next.js build cache
	$(N) npm run db:down
	rm -rf node_modules .next
