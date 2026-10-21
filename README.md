# Chits Store — Public Entry MVP v0.2

A cozy multiplayer bakery prototype, built in one **Nuxt + Phaser + SQLite** project and deployable to a single Ubuntu VPS. The local build, type check, automated public-entry suite, and two isolated browser sessions have passed. Physical two-device and deployment acceptance remain pending. See [current validation and device-test instructions](docs/PUBLIC_ENTRY_TESTING.md).

## Changes from v0.1

- **No invitations, order-based authentication, or private customer links.**
- Public home page lets anyone select a food-inspired avatar and immediately enter.
- A generated guest nickname (`Mochi #001`, etc.) avoids requiring usernames or accounts.
- A browser session represents one public visitor; returning visitors can choose a different avatar.
- WebSocket multiplayer and chat now authenticate public visitor sessions, not orders.
- Public order board shows **only order numbers and Preparing/Ready/Served statuses**.
- Removed **My Order**, personal Ready notices, and automatic ejection when an order is served, because public visitors are not linked to a particular order.
- Admin still logs in, creates orders, and advances statuses. No customer links are generated.
- Staff have optional Community Moderation controls: disable chat, temporary mute and kick.
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

The integration suite uses a temporary SQLite database and test configuration. The old invitation-only test is retained as historical coverage and skipped; `npm test` selects the public visitor suite.

URLs:

- http://localhost:3000 — public entrance, avatar selection.
- http://localhost:3000/store — walkable public bakery (after choosing an avatar).
- http://localhost:3000/admin — staff dashboard.

## Recommended tests

1. Open home page and choose an avatar. You should enter without any order number.
2. Open another browser profile and join with another avatar. Check movement and chat.
3. Login at `/admin`; create `CH-1025`. Verify it appears under Preparing for both visitors.
4. Set Ready and Served. Both visitors should see status updates; neither is kicked out.
5. Refresh one browser, return through avatar selection and confirm no invitation is needed.
6. Test moderation controls: temporarily disable chat and mute/kick a visitor.
7. Check mobile portrait layout, joystick, chat, and cashier/chef interactions.

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
