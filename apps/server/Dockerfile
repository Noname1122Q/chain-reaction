FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production

ENV NODE_ENV=production
USER bun
CMD ["bun", "apps/server/src/index.ts"]