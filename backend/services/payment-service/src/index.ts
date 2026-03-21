import 'dotenv/config'
import { config, validateConfig } from './config'
import { createApp } from './app'

validateConfig()
const app = createApp()
app.listen(config.port, () => {
  console.log(`payment-service on :${config.port}`)
})
