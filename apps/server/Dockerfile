# Built from the repo root: docker build -f apps/server/Dockerfile .

# Stage 1: Base image with pnpm
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@11.15.1

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/schemas/package.json ./packages/schemas/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --legacy --prod --ignore-scripts \
      --config.node-linker=hoisted --filter=@personal-agent/server /deploy

# Stage 3: Build the application
FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/schemas/package.json ./packages/schemas/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter=@personal-agent/server... \
 && pnpm rebuild prisma @prisma/engines

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/env ./packages/env
COPY packages/schemas ./packages/schemas
COPY apps/server ./apps/server

RUN pnpm --filter @personal-agent/db generate:db \
 && pnpm --filter @personal-agent/server build

# Stage 4: Production image
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner

WORKDIR /app/apps/server

COPY --from=prod-deps --chown=node:node /deploy/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/server/dist ./dist
COPY --chown=node:node apps/server/package.json ./

USER node

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
