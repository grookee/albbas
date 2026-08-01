# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile
RUN pnpm --filter @albbas/web build
RUN pnpm --filter @albbas/web --prod deploy --legacy /prod/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/build /app/build
COPY --from=build /prod/web/node_modules /app/node_modules
EXPOSE 3000
CMD ["node", "build/index.js"]
