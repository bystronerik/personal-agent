# Built from the repo root: docker build -f packages/db/Dockerfile .
#
# The image applies pending migrations and exits — run it to completion before
# anything that queries the schema:
#   docker run --rm --env-file .env <image>

# Stage 1: Base image with pnpm
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@11.15.1

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter=@personal-agent/db... \
 && pnpm rebuild -r prisma @prisma/engines

# Stage 3: Production image
FROM deps AS runner

COPY packages/env/src ./packages/env/src
COPY packages/db/prisma.config.ts ./packages/db/
COPY packages/db/prisma ./packages/db/prisma

WORKDIR /app/packages/db

USER node

ENV NODE_ENV=production

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
