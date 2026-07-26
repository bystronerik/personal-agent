# Built from the repo root: docker build -f apps/agent/Dockerfile .
#
# The image is the scheduled worker — it reads cron rows from Postgres and
# delivers briefs. `--once <schedule-id>` runs a single brief and exits:
#   docker run --rm --env-file .env <image> --once <schedule-id>

# Stage 1: Base image with pnpm
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@11.15.1

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/db/package.json ./packages/db/
COPY packages/embedding/package.json ./packages/embedding/
COPY packages/env/package.json ./packages/env/
COPY packages/telegram/package.json ./packages/telegram/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --legacy --prod --ignore-scripts \
      --config.node-linker=hoisted --filter=@personal-agent/agent /deploy

# Stage 3: Build the application
FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/db/package.json ./packages/db/
COPY packages/embedding/package.json ./packages/embedding/
COPY packages/env/package.json ./packages/env/
COPY packages/telegram/package.json ./packages/telegram/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter=@personal-agent/agent... \
 && pnpm rebuild prisma @prisma/engines

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/embedding ./packages/embedding
COPY packages/env ./packages/env
COPY packages/telegram ./packages/telegram
COPY apps/agent ./apps/agent

RUN pnpm --filter @personal-agent/db generate:db \
 && pnpm --filter @personal-agent/agent build

# Stage 4: Production image
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner

WORKDIR /app/apps/agent

COPY --from=prod-deps --chown=node:node /deploy/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/agent/dist ./dist
COPY --chown=node:node apps/agent/package.json ./

USER node

ENV NODE_ENV=production

# ENTRYPOINT, not CMD: `docker run <image> --once <id>` has to reach parseWorkerArgs.
ENTRYPOINT ["node", "dist/main.js"]
