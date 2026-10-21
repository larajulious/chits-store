import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function fail(message) {
  console.error(`[chits-store] ${message}`)
  process.exit(1)
}

if (Number(process.versions.node.split('.')[0]) < 24) fail('Use Node.js 24 or newer, then install dependencies on this server.')

// Existing process-manager variables take precedence over the existing file.
// Production cookies must stay secure even when the development .env is reused.
process.env.NODE_ENV = 'production'
const envFile = resolve('.env')
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile) }
  catch { fail('Could not load .env. Check its permissions and format; do not regenerate existing credentials.') }
}

const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 32 || secret.startsWith('replace_')) {
  fail('SESSION_SECRET is missing or invalid. Load the existing .env or configure the existing signing key in your process manager.')
}
const [salt, hash, extra] = (process.env.ADMIN_PASSWORD_HASH || '').split(':')
if (!salt || !hash || extra !== undefined || !/^[0-9a-f]{128}$/.test(hash)) {
  fail('ADMIN_PASSWORD_HASH is missing or invalid. Load the existing admin hash; do not generate a new password for an existing installation.')
}
const entry = resolve('.output/server/index.mjs')
if (!existsSync(entry)) fail('Production build missing. Run npm run build on the VPS, then npm start from the project directory.')

await import(pathToFileURL(entry).href)
