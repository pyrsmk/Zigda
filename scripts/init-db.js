import { readFileSync } from 'node:fs'
import { db } from '../api/_lib/db.js'

const envFile = process.argv.includes('--prod') ? '.env.production' : '.env'
try {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
} catch {}

const pool = db()
await pool.query(readFileSync(new URL('../api/_lib/schema.sql', import.meta.url), 'utf8'))
const { rows } = await pool.query(
  `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
)
console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '))
await pool.end()
