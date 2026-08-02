# syntax=docker/dockerfile:1
FROM node:25-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN pnpm --filter @albbas/api db:generate
RUN pnpm --filter @albbas/api build
RUN pnpm --filter @albbas/api --prod deploy --legacy /prod/api
WORKDIR /prod/api
RUN node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM node:25-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=build /prod/api /app
EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
