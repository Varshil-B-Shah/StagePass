import 'dotenv/config'
import { config, validateConfig } from './config'
import { createApp } from './app'

async function start() {
  validateConfig()
  const app = createApp()
  app.listen(config.port, () => {
    console.log(`[streaming-service] listening on :${config.port}`)
  })
}

start().catch((err) => {
  console.error('[streaming-service] startup failed:', err)
  process.exit(1)
})
