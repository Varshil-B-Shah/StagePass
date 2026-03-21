import { Pool } from 'pg'
import { config } from '../config'

let pool: Pool | null = null

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: config.database_url })
  }
  return pool
}
