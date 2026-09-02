# syntax=docker/dockerfile:1

# Production image for Gardik. Three stages: dependency install, Next.js
# standalone build, then a slim runner carrying only the server output plus the
# Prisma CLI needed to apply migrations on start.
# The development image (bind-mounted source, `next dev`) is Dockerfile.dev,
# which is what compose.yml builds.

ARG NODE_VERSION=26-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY docker/prisma.config.ts ./prisma.config.ts
# --ignore-scripts skips `prepare` (git hook install, meaningless in an image)
# and the postinstall generate, which is then run explicitly.
RUN npm ci --ignore-scripts \
  && npx prisma generate

# The Prisma CLI is not self-contained (its config loader pulls extra runtime
# packages), so it gets its own tiny install tree instead of being cherry-picked
# out of the app dependencies. Version comes from the lockfile.
FROM node:${NODE_VERSION} AS migrator
WORKDIR /opt/prisma
COPY package.json package-lock.json ./
RUN PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && rm package.json package-lock.json \
  && npm init -y > /dev/null \
  # Scripts stay enabled here on purpose: @prisma/engines fetches the schema
  # engine binary in its postinstall, and migrate deploy needs it at runtime.
  && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"
COPY docker/prisma.config.ts ./prisma.config.ts

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders so the build never fails on a module that reads these at import
# time. Nothing here is baked into the output: every value is re-read from the
# environment at runtime.
ENV DATABASE_URL=postgresql://build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret \
    BETTER_AUTH_URL=http://localhost:3000 \
    DIRECTORY_ENCRYPTION_KEY=build-time-placeholder-not-a-real-key-32
RUN npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

# openssl is required by the Prisma CLI that applies migrations on start.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone output: server.js plus the traced runtime dependencies.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migrations run at container start, so the runner needs the schema and the
# migration history alongside the isolated CLI tree.
COPY --from=builder /app/prisma ./prisma
COPY --from=migrator /opt/prisma /opt/prisma
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# The server writes its incremental cache under .next/cache, and the Prisma CLI
# refuses to start unless its engines directory is writable, so both paths are
# handed to the unprivileged user the container runs as.
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p .next/cache \
  && chown -R node:node /app/.next /opt/prisma

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
