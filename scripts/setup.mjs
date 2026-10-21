import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

const path = join(process.cwd(), '.env')
if (existsSync(path)) {
  console.error('A .env file already exists. Not overwriting your secrets.')
  process.exit(1)
}
const password = randomBytes(18).toString('base64url')
const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
writeFileSync(path, [
  `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
  `ADMIN_PASSWORD_HASH=${salt}:${hash}`,
  'SQLITE_PATH=./.data/chits-store.sqlite',
  'NODE_ENV=development',
  '',
].join('\n'), { mode: 0o600 })
chmodSync(path, 0o600)
console.log('Created .env. Copy this admin password to your password manager NOW:')
console.log(`\n  ${password}\n`)
console.log('It is not saved as plaintext and cannot be displayed again.')
