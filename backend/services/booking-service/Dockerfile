FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@8.15.0

# Install deps at workspace root so pnpm resolves @stagepass/shared
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY shared/package.json ./shared/
COPY services/booking-service/package.json ./services/booking-service/
RUN pnpm install --no-frozen-lockfile

# Dev target (used by docker-compose volume mounts)
FROM deps AS dev
COPY shared ./shared
COPY services/booking-service ./services/booking-service
WORKDIR /app/services/booking-service
CMD ["pnpm", "dev"]

# Production build
FROM deps AS build
COPY shared ./shared
COPY services/booking-service ./services/booking-service
WORKDIR /app/services/booking-service
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/services/booking-service/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/booking-service/node_modules ./services/booking-service/node_modules
COPY --from=build /app/services/booking-service/prisma ./prisma
CMD ["node", "dist/index.js"]
