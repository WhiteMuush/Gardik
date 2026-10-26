# syntax=docker/dockerfile:1

# Production image for Gardik. Three stages: dependency install, Next.js
# standalone build, then a slim runner carrying only the server output plus the
# Prisma CLI needed to apply migrations on start.
# The development image (bind-mounted source, `next dev`) is Dockerfile.dev,
# which is what compose.yml builds.

# Alpine over Debian slim: the Debian base alone carried 4 critical and 50+ high
# advisories (perl, util-linux, pam...) that nothing in this app uses.
ARG NODE_VERSION=26-alpine

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
# The overrides that pin vulnerable transitive dependencies live in the app
# manifest, but `npm init -y` starts from an empty one, so this tree used to
# install them unconstrained. Carrying the block over keeps the two in sync
# without a second list to maintain.
RUN PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && OVERRIDES=$(node -p "JSON.stringify(require('./package.json').overrides || {})") \
  && rm package.json package-lock.json \
  && npm init -y > /dev/null \
  && node -e "const fs=require('fs'),p=require('./package.json');p.overrides=JSON.parse(process.argv[1]);fs.writeFileSync('package.json',JSON.stringify(p,null,2))" "$OVERRIDES" \
  # Scripts stay enabled here on purpose: @prisma/engines fetches the schema
  # engine binary in its postinstall, and migrate deploy needs it at runtime.
  && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"
COPY docker/prisma.config.ts ./prisma.config.ts
# The runner only ever calls `migrate deploy`. A file-access trace of it (fresh
# database, up-to-date database, unreachable host) never opened the Studio web
# UI nor the embedded Postgres behind `prisma dev`, which are about 90 MB of
# this tree. `--version` boots the CLI and its eager imports, so a Prisma
# release that starts needing one of these fails the build, not the container.
RUN rm -rf node_modules/@electric-sql node_modules/@prisma/studio-core/dist/ui \
    node_modules/@prisma/studio-core/dist/metafile-*.json node_modules/react node_modules/react-dom \
    node_modules/@radix-ui node_modules/@visx node_modules/d3-* node_modules/elkjs node_modules/lodash \
    node_modules/csstype node_modules/@types \
  && node node_modules/prisma/build/index.js --version > /dev/null

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
# npm is not: the entrypoint resolves the Prisma bundle with `node`, the CMD is
# `node server.js`, and the healthcheck is `node -e`. Dropping it removes the
# CVEs carried by its own bundled dependency tree, which no override in this
# repository can reach.
# The upgrade closes base-image CVEs that Alpine has already patched but the
# upstream node image has not rebuilt against yet. It only does so if the layer
# is rebuilt, which is why the publish workflow builds without a persistent
# cache.
RUN apk upgrade --no-cache \
  && apk add --no-cache openssl \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone output: server.js plus the traced runtime dependencies.
# The server writes its incremental cache under .next, and the Prisma CLI
# refuses to start unless its engines directory is writable, so those two trees
# are handed to the unprivileged user while the rest stays root-owned.
# Ownership is set by COPY --chown: a later `chown -R` would rewrite every file
# into a new layer and ship the whole tree twice (about 290 MB).
COPY --from=builder /app/.next/standalone/server.js /app/.next/standalone/package.json ./
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/standalone/.next ./.next
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migrations run at container start, so the runner needs the schema and the
# migration history alongside the isolated CLI tree.
COPY --from=builder /app/prisma ./prisma
COPY --from=migrator --chown=node:node /opt/prisma /opt/prisma
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

USER node
RUN mkdir -p .next/cache

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
