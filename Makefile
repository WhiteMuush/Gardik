# DataShield developer tasks. Thin wrapper over the npm scripts and
# scripts/db-init.sh so a fresh clone can be brought up with a single command.
# Requires Node 22 and (for the local database) Docker.

.DEFAULT_GOAL := help
SHELL := /bin/sh

# Run npm/npx under the project's Node version (.nvmrc) via nvm when available,
# so the targets work even when the shell's default Node is wrong.
N := sh scripts/use-node.sh

.PHONY: help setup install env db-up db-down db-init migrate seed seed-dev \
        run build lint lint-fix test check doctor clean

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: install env db-init ## One-shot: install deps, create .env.local, start DB, migrate, seed
	@echo "Setup complete. Start the app with 'make run'."

install: ## Install dependencies (also runs prisma generate)
	$(N) npm install

env: ## Create .env.local from .env.example with generated secrets (no-op if it exists)
	@sh scripts/env-init.sh

db-up: ## Start the local PostgreSQL container
	$(N) npm run db:up

db-down: ## Stop the local database container
	$(N) npm run db:down

db-init: ## Start DB, apply migrations, seed demo data (Docker required)
	$(N) npm run db:init

migrate: ## Apply pending Prisma migrations
	$(N) npm run db:migrate

seed: ## Seed the base admin account
	$(N) npm run seed

seed-dev: ## Seed demo data for development
	$(N) npm run seed:dev

run: ## Run the dev server
	$(N) npm run dev

build: ## Production build
	$(N) npm run build

lint: ## Lint
	$(N) npm run lint

lint-fix: ## Lint and auto-fix
	$(N) npm run lint:fix

test: ## Run the test suite
	$(N) npm test

check: ## Run the same gates CI enforces (lint, types, schema, build)
	$(N) npm run lint -- --max-warnings 0
	$(N) npx tsc --noEmit
	$(N) npx prisma validate
	$(N) npm run build

doctor: ## Full setup diagnosis with optional auto-fix (toolchain, env, Docker, DB, Prisma)
	@sh scripts/doctor.sh

clean: ## Stop the DB and remove node_modules and the Next.js build cache
	$(N) npm run db:down
	rm -rf node_modules .next
