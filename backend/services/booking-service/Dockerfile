FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@8.15.0

# Install deps
# Build context is backend/ — both booking-service and shared are accessible
FROM base AS deps
COPY services/booking-service/package.json ./
COPY shared/package.json ./shared/
RUN pnpm install --frozen-lockfile

# Dev target (used by docker-compose volume mounts)
FROM deps AS dev
COPY services/booking-service .
COPY shared ./shared
CMD ["pnpm", "dev"]

# Production build
FROM deps AS build
COPY services/booking-service .
COPY shared ./shared
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
CMD ["node", "dist/index.js"]
