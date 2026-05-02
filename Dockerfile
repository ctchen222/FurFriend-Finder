FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch

FROM deps AS build

RUN pnpm install --frozen-lockfile --offline
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM deps AS prod-deps

RUN pnpm install --prod --frozen-lockfile --offline \
    && pnpm store prune

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=2486

COPY package.json pnpm-lock.yaml ./
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY views ./views
COPY sql ./sql

USER node

EXPOSE 2486

CMD ["node", "--require", "./dist/instrumentation.js", "dist/app.js"]
