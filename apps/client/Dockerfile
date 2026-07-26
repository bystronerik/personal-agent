# Built from the repo root: docker build -f apps/client/Dockerfile .
#
# Vite inlines every VITE_-prefixed value into the bundle, so these are build
# arguments rather than runtime environment — a different Auth0 tenant or API
# origin is a different image. Only public identifiers belong here; a build
# argument is readable in the image history, and the bundle is public anyway.

# Stage 1: Base image with pnpm
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@11.15.1

WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/schemas/package.json ./packages/schemas/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --filter=@personal-agent/client... \
 && pnpm rebuild esbuild @swc/core prisma @prisma/engines

# Stage 3: Build the application
FROM deps AS builder

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/env ./packages/env
COPY packages/schemas ./packages/schemas
COPY apps/client ./apps/client
COPY apps/server ./apps/server

ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_API_URL

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @personal-agent/db generate:db \
 && pnpm --filter @personal-agent/server generate:spec \
 && pnpm --filter @personal-agent/client build

# Stage 4: Production image with nginx
FROM nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752 AS runner

RUN rm /etc/nginx/conf.d/default.conf \
       /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh \
 && sed -i \
      -e '/^user[[:space:]]/d' \
      -e 's@/run/nginx.pid@/tmp/nginx.pid@' \
      /etc/nginx/nginx.conf

COPY apps/client/nginx.conf /etc/nginx/conf.d/personal-agent.conf
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
