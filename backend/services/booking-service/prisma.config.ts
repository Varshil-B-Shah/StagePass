import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts',
  },
  datasource: {
    // DIRECT_URL bypasses pgBouncer — required for Prisma CLI (migrate, generate)
    url: process.env.DIRECT_URL ?? '',
  },
})
