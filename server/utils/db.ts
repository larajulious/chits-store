import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {OrderStatus} from '../../shared/order-status'

export type Status = OrderStatus
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
  status: Exclude<Status,'Delivered'>
  token_hash: string
  nickname: string | null
  avatar_key: string | null
  created_at: number
  updated_at: number
  served_at: number | null
  delivered_at: number | null
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
        delivered_at INTEGER,
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, updated_at);
      CREATE TABLE IF NOT EXISTS order_sequence (
        id INTEGER PRIMARY KEY CHECK (id=1),
        next_number INTEGER NOT NULL CHECK (next_number>=100)
      );
      CREATE TABLE IF NOT EXISTS store_settings (
        id INTEGER PRIMARY KEY CHECK (id=1),
        is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0,1))
      );
      INSERT OR IGNORE INTO store_settings(id,is_open) VALUES(1,1);
      CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        avatar_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id INTEGER NOT NULL,
        nickname TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('suggestion','review')),
        text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        created_at INTEGER NOT NULL,
        approved_at INTEGER,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS feedback_public_idx ON feedback(status, expires_at, approved_at);
      CREATE INDEX IF NOT EXISTS feedback_visitor_idx ON feedback(visitor_id, created_at);
      CREATE TABLE IF NOT EXISTS daily_menu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_date TEXT NOT NULL,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
        price_centavos INTEGER NOT NULL CHECK (price_centavos BETWEEN 1 AND 1000000),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS daily_menu_date_idx ON daily_menu(service_date, id);
    `)
    // Add completion without rebuilding legacy tables or changing their status CHECK.
    const connection=database
    connection.transaction(()=>{
      const columns=connection.pragma('table_info(orders)') as {name:string}[]
      if(!columns.some(column=>column.name==='delivered_at'))connection.exec('ALTER TABLE orders ADD COLUMN delivered_at INTEGER')
    }).immediate()
  }
  return database
}
export const getOrder = (id: number) => db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
export const getVisitor = (id: number) => db().prepare('SELECT * FROM visitors WHERE id = ?').get(id) as VisitorRow | undefined
export const activeVisitor = (visitor: VisitorRow | undefined) => Boolean(visitor && !visitor.revoked_at && Date.now() - visitor.last_seen_at < 7 * 24 * 60 * 60_000)
export const publicOrder = (row: OrderRow) => ({ id: row.id, number: row.order_number, status:row.status==='Served'&&row.delivered_at!=null?'Delivered' as const:row.status })
