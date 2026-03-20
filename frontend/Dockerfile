FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@8.15.0

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

FROM deps AS dev
COPY . .
CMD ["pnpm", "dev"]

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
CMD ["pnpm", "start"]
