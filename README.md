# Chits Store — Public Entry MVP v0.2

A cozy multiplayer bakery prototype, built in one **Nuxt + Phaser + SQLite** project and deployable to a single Ubuntu VPS. The local build, type check, automated public-entry suite, and two isolated browser sessions have passed. Physical two-device and deployment acceptance remain pending. See [current validation and device-test instructions](docs/PUBLIC_ENTRY_TESTING.md).

## Changes from v0.1

- **No invitations, order-based authentication, or private customer links.**
- Public home page lets anyone select a food-inspired avatar and immediately enter.
- Staff can close or reopen the store from a header button beside Today's menu. Closing stops new entries and returns connected visitors to the closed welcome screen; reopening allows entry again. The open/closed state is stored in SQLite and survives server restarts. The welcome screen shows the status and checks again every 15 seconds.
- The structured pixel layout is the only public layout at `/` and `/store`; no preview query parameter is needed.
- The welcome-page storefront has subtle pixel animation: warm windows, a gently pulsing sign, a door that occasionally opens, and chimney puffs. When closed, its door stays shut, the windows dim and gently pulse, and small “Z”s drift above the roof. Reduced motion keeps both scenes still.
- A generated guest nickname (`Mochi #001`, etc.) avoids requiring usernames or accounts.
- Miming, the resident shop cat, roams and rests independently in each visitor's browser. Visitors can drag or toss their own yarn ball and pet their own cat when nearby; see [performance audit and device checklist](docs/RESIDENT_CAT_PERFORMANCE.md).
- A browser session represents one public visitor; returning visitors can choose a different avatar.
- WebSocket multiplayer and chat now authenticate public visitor sessions, not orders.
- Public order board shows **only order numbers and Preparing/Ready/Out for Delivery/Delivered statuses**. The in-game Live Orders board spells out **Preparing** and lists up to five most recent Out for Delivery orders; the Orders panel keeps the full public feed. Orders remain active through Out for Delivery; Delivered orders remain on the public board for five minutes and in admin history.
- Removed **My Order**, personal Ready notices, and automatic ejection when an order goes out for delivery, because public visitors are not linked to a particular order.
- Admin still logs in, creates orders, and advances statuses. Create order assigns numbers automatically: **100, 101, 102…**. The SQLite counter survives restarts and skips numbers already in use; existing orders keep their numbers. No customer links are generated.
- Staff have optional Community Moderation controls: disable chat, temporary mute and kick.
- Staff can open **Today's menu** in the admin header to add, edit and remove up to 30 items with peso prices. The menu is stored in SQLite for the current Manila date; a fresh list starts the next day without deleting older records. A small food mascot walks independently in each visitor's browser and opens the locally cached menu when tapped. Staff changes reach connected visitors through a lightweight WebSocket notification. Visitors can also use the Menu action below the game.
- Staff can open **Reset data** in the admin header to clear selected categories: today's menu, orders and order number counter, suggestions/reviews, current chat history, or visitor sessions. The dialog requires typing `RESET`; the existing admin session authorizes the action. Resetting visitor sessions sends connected visitors back to the entrance; admin credentials and store availability are preserved. Back up the SQLite database before clearing records you may need later.
- The admin dashboard includes Customer chat: read visitor messages and reply as verified staff in the same public Community Chat. Messages are limited to 160 characters; the latest 50 are temporary and clear on server restart. Pausing public chat also pauses staff sends.
- Visitors can tap the pixel feedback box near the entrance or the Feedback action to send a suggestion or review (up to 500 characters). Staff approve/reject submissions in **Customer feedback** and can hide published posts. Only approved posts appear publicly, for **10 hours after approval**; expiry persists across restarts and posts disappear from an open board automatically.
- Feedback is stored locally in an additive SQLite table. Pending/rejected/expired records are retained privately; visibility expiry does not delete them. Public and staff lists show up to 50 posts per queue. Submission limits are three per visitor per hour, at least one minute apart, plus ten per address per hour.
- The Leave button asks for confirmation. Confirming returns to the welcome screen with “Thank you for visiting Chits Meryenda Hub!”; cancelling keeps the visit connected.
- In-store food characters are slightly larger and gently breathe and blink while idle, with a small squash, bounce and lean while walking. Cosmetic motion respects the browser’s reduced-motion preference and does not change game positions.
- The chef stirs a pan of meryenda at the kitchen stove while food bubbles and steam rises. The cooking motion becomes a still scene when reduced motion is preferred.
- Staff messages also appear as temporary speech bubbles above the in-game cashier for connected customers; the full messages remain in Community Chat.
- On desktop, the dashboard shows order creation and a filtered order queue alongside customer chat. Preparing, Ready, Out for Delivery and Delivered counts reflect the most recent 100 orders; The queue opens on Preparing and offers Preparing, Ready, Out for Delivery and Delivered filters. Use Mark delivered on an Out for Delivery order, confirm receipt, then find completed orders under Delivered. Smaller screens use a stacked layout.
- Original `/enter/:token` links redirect to the public entrance for compatibility.

## Setup on macOS

Requires Node.js 24 LTS, npm, C++ build tools for `better-sqlite3`.

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` generates `.env`, a random admin password, and signing key. Keep them private. **If you already have a v0.1 installation, keep the existing `.env` and `.data` and do not run setup again.** The schema retains the old unused `orders.token_hash` database field for compatibility with existing SQLite files; it is not used for public access.

For an existing installation, use `npm install` and `npm run dev`; skip setup. To validate changes, run:

```bash
npm run typecheck
npm run build
npm test
```

The integration suites use temporary SQLite databases and test configuration. The old invitation-only test is retained as historical coverage outside the current test command; `npm test` runs public visitor, feedback, daily menu, store availability, automatic numbering and production-start coverage.

URLs:

- http://localhost:3000 — public entrance, avatar selection.
- http://localhost:3000/store — walkable public bakery (after choosing an avatar).
- http://localhost:3000/admin — staff dashboard.

## Recommended tests

1. Open home page and choose an avatar. You should enter without any order number.
2. Open another browser profile and join with another avatar. Check movement and chat.
3. Login at `/admin` and click **Create order**. Verify the automatically assigned number appears under Preparing for both visitors. On a fresh database the first two orders are 100 and 101; existing numbers are skipped.
4. Set Ready, Out for Delivery, then Delivered. Both visitors should see status updates; neither is kicked out.
5. Refresh one browser, return through avatar selection and confirm no invitation is needed.
6. Test moderation controls: temporarily disable chat and mute/kick a visitor.
7. Check mobile portrait layout, joystick, chat, and cashier/chef interactions.
8. In admin, close the store and confirm the warning. Visitors inside should return automatically to the closed welcome screen, where entry is disabled. Reopen the store and check that entry works again.
9. Open the same visitor session in two tabs. The older tab should return to the welcome screen automatically while the new tab stays connected.
10. In admin, add today's menu items and prices, edit one and remove another. In the store, tap the walking **MENU • TAP** character or the Menu action; confirm the prices update and a fresh menu appears after the Manila date changes.

## Running on a VPS

Keep the existing `.env` and `.data`; do not run setup again. Install dependencies and build **on the VPS with Node.js 24+** so `better-sqlite3` uses the correct operating-system/Node binary. Copying a macOS `node_modules` or `.output/server/node_modules` directory to Linux can break SQLite when the first visitor joins.

From the project directory, after updating the project files:

```bash
npm ci
npm run build
npm start
```

`npm start` loads the existing `.env` and checks the signing key/admin hash before listening. Process-manager environment variables take precedence. It enforces production mode even if the local `.env` contains `NODE_ENV=development`. The raw `node .output/server/index.mjs` command does not automatically load `.env`; a missing signing key can otherwise leave the home page working while entry returns HTTP 500.

Keep your assigned `HOST`/`PORT` (or `NITRO_HOST`/`NITRO_PORT`) and existing reverse proxy configuration. Use HTTPS for browser entry: production session cookies are Secure. `SQLITE_PATH` must point to the persistent database, and the process user needs write access to its directory for SQLite/WAL files.

For PM2, edit `cwd` and the assigned port in `deploy/pm2.ecosystem.cjs` to match the installation. That example now uses the same launcher, in one fork process. Apply the updated configuration:

```bash
pm2 startOrReload deploy/pm2.ecosystem.cjs --only chits-store --update-env
pm2 logs chits-store --lines 40 --nostream
```

If entry still fails, identify the error in those logs before changing configuration:

- `SESSION_SECRET`/`ADMIN_PASSWORD_HASH`: verify the existing values are loaded; keep the original credentials.
- `invalid ELF header`, `NODE_MODULE_VERSION`, missing bindings: reinstall dependencies and rebuild on the VPS under the Node version used to run the app.
- `SQLITE_CANTOPEN`, `SQLITE_READONLY`, permission denied: check the persistent path and database-directory ownership for the process user.
- `Invalid request origin` (403): match `PUBLIC_ORIGIN` to the exact HTTPS site origin and preserve the browser Host header through Nginx. Keep origin checks enabled.

## Architecture

- `app/pages/index.vue` — public avatar selection and animated storefront
- `app/pages/store.vue` — multiplayer game, public board and chat
- `app/pages/admin/index.vue` — staff dashboard and optional moderation
- `game/createGame.ts` — temporary Phaser scene; art assets not final
- `server/api/visitors/join.post.ts` — public visitor session creation
- `server/api/orders/board.get.ts` — public-safe order status listing
- `server/routes/ws.ts` — room movement, chat, presence
- `server/utils/room.ts` — one-process room and moderation state
- `server/utils/db.ts` — SQLite orders and visitors tables
- `server/utils/auth.ts` — signed visitor/admin cookies and admin login

## Security & deployment cautions

- Public chat invites abuse. The starter adds basic rate limits, temporary mute/kick, chat on/off. **Do not launch publicly without moderation review, abuse testing, reporting/blocking rules, and access controls.**
- The current room limit is 40 concurrent players. It is an initial safeguard, **not a demonstrated performance capacity**; load-test on your VPS.
- WebSocket implementation relies on Nitro's experimental handler; test it with the pinned Nuxt/h3 combination.
- One Node process only for room state. PM2 cluster mode would split visitors into isolated memory rooms.
- Use Nginx with HTTPS and `proxy_set_header Upgrade` for `wss://`. Limit public firewall ports and run Node as an unprivileged account.
- Set `PUBLIC_ORIGIN` to the exact HTTPS origin in production. Leave it unset for local LAN testing. Enable `TRUST_PROXY=1` only with Node bound to loopback behind the supplied Nginx proxy, which overwrites `X-Real-IP` for login/join rate limits.
- Back up SQLite using SQLite's online backup mechanism or `.backup` to include WAL changes. Do not copy only the database file while writing.
- The public board deliberately includes order numbers. Never use order numbers containing names or personal identifiers.
- Admin password and session signing secret are only in `.env`. Do not commit it.

## Changes intentionally deferred

Final original sprite art, explicit reporting/blocking tools, persistent bans, audio, lobby capacity management, robust proximity collisions, production load tests, and persistent shared-chat logs. There is no payment or online ordering system.
