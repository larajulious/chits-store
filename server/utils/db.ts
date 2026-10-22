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
  status: Exclude<Status,'Delivered'|'Pending'>
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
      CREATE TABLE IF NOT EXISTS customer_orders (
        order_id INTEGER PRIMARY KEY,
        visitor_id INTEGER NOT NULL,
        service_date TEXT NOT NULL,
        total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
        confirmed_at INTEGER,
        staff_read_message_id INTEGER NOT NULL DEFAULT 0,
        visitor_read_message_id INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS customer_orders_visitor_idx ON customer_orders(visitor_id, order_id DESC);
      CREATE TABLE IF NOT EXISTS customer_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price_centavos INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        line_total_centavos INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS customer_order_items_order_idx ON customer_order_items(order_id, id);
      CREATE TABLE IF NOT EXISTS order_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('visitor','staff','system')),
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS order_messages_order_idx ON order_messages(order_id, id);
    `)
    // Add completion without rebuilding legacy tables or changing their status CHECK.
    const connection=database
    connection.transaction(()=>{
      const columns=connection.pragma('table_info(orders)') as {name:string}[]
      if(!columns.some(column=>column.name==='delivered_at'))connection.exec('ALTER TABLE orders ADD COLUMN delivered_at INTEGER')
      const customerColumns=connection.pragma('table_info(customer_orders)') as {name:string}[]
      if(!customerColumns.some(column=>column.name==='confirmed_at')){
        connection.exec('ALTER TABLE customer_orders ADD COLUMN confirmed_at INTEGER')
        // Orders placed before confirmation existed were already Preparing.
        connection.exec('UPDATE customer_orders SET confirmed_at=created_at')
      }
    }).immediate()
  }
  return database
}
export const getOrder = (id: number) => db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
export const getVisitor = (id: number) => db().prepare('SELECT * FROM visitors WHERE id = ?').get(id) as VisitorRow | undefined
export const activeVisitor = (visitor: VisitorRow | undefined) => Boolean(visitor && !visitor.revoked_at && Date.now() - visitor.last_seen_at < 7 * 24 * 60 * 60_000)
export const publicOrder = (row: OrderRow,pending=false) => ({ id: row.id, number: row.order_number, name:row.nickname, status:pending?'Pending' as const:row.status==='Served'&&row.delivered_at!=null?'Delivered' as const:row.status })
