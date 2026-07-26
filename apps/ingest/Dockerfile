# Built from the repo root: docker build -f apps/ingest/Dockerfile .
#
# The image is the corpus poller — it holds a static feed list, fetches and
# embeds what is new, and sweeps what has aged out. `--once` polls every source
# and exits:
#   docker run --rm --env-file .env <image> --once

# Stage 1: Base image with pnpm
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@11.15.1

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ingest/package.json ./apps/ingest/
COPY packages/db/package.json ./packages/db/
COPY packages/embedding/package.json ./packages/embedding/
COPY packages/env/package.json ./packages/env/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --legacy --prod --ignore-scripts \
      --config.node-linker=hoisted --filter=@personal-agent/ingest /deploy

# Stage 3: Build the application
FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ingest/package.json ./apps/ingest/
COPY packages/db/package.json ./packages/db/
COPY packages/embedding/package.json ./packages/embedding/
COPY packages/env/package.json ./packages/env/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter=@personal-agent/ingest... \
 && pnpm rebuild prisma @prisma/engines

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/embedding ./packages/embedding
COPY packages/env ./packages/env
COPY apps/ingest ./apps/ingest

RUN pnpm --filter @personal-agent/db generate:db \
 && pnpm --filter @personal-agent/ingest build

# Stage 4: Production image
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner

WORKDIR /app/apps/ingest

COPY --from=prod-deps --chown=node:node /deploy/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/ingest/dist ./dist
COPY --chown=node:node apps/ingest/package.json ./

USER node

ENV NODE_ENV=production

# ENTRYPOINT, not CMD: `docker run <image> --once` has to reach parseArgs.
ENTRYPOINT ["node", "dist/main.js"]
