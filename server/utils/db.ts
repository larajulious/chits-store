import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export type Status = 'Preparing' | 'Ready' | 'Served'
export type VisitorRow = {
  id: number
  avatar_key: string
  created_at: number
  last_seen_at: number
  revoked_at: number | null
}

export type OrderRow = {
  id: number
  order_number: string
  status: Status
  token_hash: string
  nickname: string | null
  avatar_key: string | null
  created_at: number
  updated_at: number
  served_at: number | null
  revoked_at: number | null
}

let database: Database.Database | undefined
export function db() {
  if (!database) {
    const path = resolve(process.env.SQLITE_PATH || './.data/chits-store.sqlite')
    mkdirSync(dirname(path), { recursive: true })
    database = new Database(path)
    database.pragma('journal_mode = WAL')
    database.pragma('busy_timeout = 5000')
    database.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'Preparing' CHECK (status IN ('Preparing','Ready','Served')),
        token_hash TEXT NOT NULL UNIQUE,
        nickname TEXT,
        avatar_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        served_at INTEGER,
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, updated_at);
      CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        avatar_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
    `)
  }
  return database
}
export const getOrder = (id: number) => db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
export const getVisitor = (id: number) => db().prepare('SELECT * FROM visitors WHERE id = ?').get(id) as VisitorRow | undefined
export const activeVisitor = (visitor: VisitorRow | undefined) => Boolean(visitor && !visitor.revoked_at && Date.now() - visitor.last_seen_at < 7 * 24 * 60 * 60_000)
export const publicOrder = (row: OrderRow) => ({ id: row.id, number: row.order_number, status: row.status })
