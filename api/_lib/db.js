import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

pg.types.setTypeParser(20, Number)

let pool
let ready

export function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    const url = new URL(process.env.DATABASE_URL)
    url.searchParams.delete('sslmode')
    const connectionString = url.toString()
    const local = /localhost|127\.0\.0\.1|host=\//.test(connectionString)
    pool = new pg.Pool({
      connectionString,
      max: 3,
      ssl: !local,
    })
  }
  return pool
}

export function migrate() {
  ready ??= (async () => {
    const sql = await readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8')
    await db().query(sql)
  })().catch((err) => {
    ready = null
    throw err
  })
  return ready
}

export async function query(text, params) {
  await migrate()
  const { rows } = await db().query(text, params)
  return rows
}

export async function one(text, params) {
  const rows = await query(text, params)
  return rows[0] ?? null
}
