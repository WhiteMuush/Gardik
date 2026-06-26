# Development image: runs `next dev` with the source bind-mounted from the host,
# so a machine only needs Docker, no Node or nvm. Not for production.
FROM node:22-bookworm-slim

# Prisma needs openssl at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps inside the image (cached, shadowed from the host by an anonymous
# volume in compose). The prisma schema is needed by the postinstall generate.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY .githooks ./.githooks
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
