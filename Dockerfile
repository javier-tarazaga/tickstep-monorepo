# syntax=docker/dockerfile:1
#
# Container image for the TickStep NestJS API (apps/api).
#
# The build context is the MONOREPO ROOT (it needs the pnpm workspace, the
# lockfile, and the shared-* packages). Deploy to Cloud Run with:
#
#   gcloud run deploy tickstep-api --source . --region <region>
#
# (Cloud Build picks up this root Dockerfile automatically.)

# ---- Builder ----------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# OpenSSL must be present BEFORE `prisma generate` runs, otherwise Prisma can't
# detect the libssl version and bundles the wrong query engine (defaults to
# openssl-1.1.x), which then fails to load against the OpenSSL 3.0 runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm comes from corepack; version is pinned by the root package.json
# "packageManager" field, so no global install is needed.
RUN corepack enable

# Copy the whole workspace (see .dockerignore for what's excluded) and install
# ONLY the API's dependency subtree. The "..." suffix includes its workspace
# deps (shared-types, shared-utils) while skipping the desktop/mobile apps so
# their heavy dependencies (electron, expo) are never installed here.
COPY . .
RUN pnpm install --frozen-lockfile --filter "@todo-app/api..."

# Build shared-types -> shared-utils -> api in dependency order. The api build
# script also runs `prisma generate`, producing the query engine for this
# Linux image.
RUN pnpm --filter "@todo-app/api..." run build

# ---- Runtime ----------------------------------------------------------------
FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Prisma's query engine needs OpenSSL; ca-certificates is needed for TLS to
# Supabase (Postgres pooler + Auth).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring over the fully-installed workspace: the compiled api dist, node_modules
# (including the generated Prisma client), and the shared-* package dists that
# are referenced via pnpm workspace symlinks.
COPY --from=builder /app /app

WORKDIR /app/apps/api

# Cloud Run injects PORT (default 8080); main.ts already honours process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/main.js"]
