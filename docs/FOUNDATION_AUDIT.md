# Functional foundation audit — October 21, 2026

> Historical v0.1 invitation-only audit. The v0.2 public-entry snapshot changes the access model and replaced several audited files. See [current public-entry validation](PUBLIC_ENTRY_TESTING.md); the results below are not current acceptance evidence for v0.2.

## Scope and outcome

Reviewed the existing app pages/components/CSS, Phaser scene, every server handler and utility, setup script, deployment templates, package configuration, and existing documentation. Installed dependencies and ran the Nuxt build, full type checking, HTTP/WebSocket integration tests, browser workflows, npm audit, and an isolated Nginx syntax test.

Nuxt 4.5.2 + Phaser 3.90.0 + better-sqlite3 remain in place. No database schema migration, paid service, pixel-art redesign, or deployment was introduced. Existing `.env`, store database, and the original development server on port 3000 were not used by the tests or overwritten. Temporary test servers and browser tabs were closed afterward. No commit was created.

The local functional scenarios pass. This is not production acceptance; the remaining security, operational, and device checks below still apply.

## Confirmed problems fixed

- Signed cookies now require a canonical 64-character hexadecimal MAC and safe integer fields. Example session secrets and malformed password-hash configuration fail closed.
- HTTP mutations and WebSocket upgrades reject missing, malformed, null, and cross-site origins. `PUBLIC_ORIGIN` can pin the exact public origin. WebSocket upgrades also reject absent/expired guest sessions and incomplete profiles before accepting a connection.
- Previously, a WebSocket checked cookie expiry only when it opened. It now retains the signed expiry and checks order access/session expiry before sending broadcasts and processing messages. A one-second sweep closes idle expired or revoked visits, including Served visits that reconnect after a server restart. The five-minute Served grace period is unchanged.
- Untrusted JSON must be an object, with explicit field types at input boundaries. Malformed WebSocket JSON, nulls, arrays, and objects that fail string/number coercion no longer throw in the handler.
- HTTP bodies are limited to 4 KiB, including chunked bodies. Oversized streams return 413 without destroying the request before Nitro finishes its response. The initial regression run caught an uncaught Nitro finish-hook exception in that rejection path; the final suite asserts no uncaught exceptions or unhandled rejections.
- The Node WebSocket adapter rejects frames over 4 KiB before application parsing. Connections are capped at 64; message floods over 40 messages per second close the socket. Existing chat/emote cooldowns are retained across replacement connections for the same order.
- Login failures are bounded/expired in memory. Concurrent requests increment the latest failure count after reading their bodies. An explicitly trusted loopback Nginx proxy can provide the client IP, so one visitor cannot consume every proxied visitor's shared loopback login allowance. Untrusted forwarding headers are ignored unless `TRUST_PROXY=1` and the direct peer is loopback.
- A replacement connection receives the current personal order status in its welcome message. The old tab receives an explicit replacement message and stops reconnecting. Reconnecting clients refresh their board/order state, clear stale presence, and reset the local avatar to the server's welcome position. Failed/expired visits show Closed.
- Served/idempotent status requests no longer rebroadcast notifications or create additional expiry timers. Forward-only transitions and the original Served timestamp are preserved.
- The client no longer clears a chat draft when disconnected, and an asynchronous Phaser import cannot create a game after its component unmounts.
- Added response protections against framing, MIME sniffing, referrer leakage, shared caching, and unnecessary device permissions. The Nginx template limits request bodies and omits invitation paths from its access log. Setup creates `.env` exclusively with mode 0600.
- Added the missing Nuxt TypeScript project configuration and checker. Fixed checked-index and override errors in the existing Phaser path/movement code without replacing it. Server movement bounds now match the client's outer walking bounds.

The background Graphics lifetime fix from the preceding smoke test remains intact. No further art changes were made.

## Checks actually executed

Environment: Node.js 24.15.0, npm 11.12.1, Nuxt 4.5.2, Nitro 2.13.5, TypeScript 5.9.3, Vue 3.5.44, Phaser 3.90.0, better-sqlite3 12.11.1.

| Check | Result and scope |
| --- | --- |
| `npm install` | Passed; subsequently installed `vue-tsc` and `ws` as development dependencies. |
| `npm run typecheck` | Passed for the final source. Initial run exposed existing type errors, which were fixed. |
| `npm run build` | Passed for the final source. Vite still warns about the large Phaser chunk. |
| `npm test` | Passed: Node reports 14 tests, comprising 12 integration subtests, their wrapper, and the isolated setup test. |
| `npm audit --json` | Completed with 11 high, zero critical findings; unresolved findings are described below. |
| `nginx -t` | Passed with the supplied template wrapped in an isolated temporary config. Only the access-log path was redirected to a temporary directory. No system Nginx configuration was changed or server started. |
| Browser workflows | Passed in the Codex in-app browser using two host-isolated customer sessions, plus replacement/expired-invitation tabs. |

The integration suite starts the built Node server with `NODE_ENV=production`, a random free loopback port, generated credentials, an exact `PUBLIC_ORIGIN`, and a temporary SQLite database. It exercises:

1. Admin success/failure, authorization, signed-cookie tampering/expiry/scope, HttpOnly/Secure/SameSite flags, and private response headers.
2. Missing/cross-site/malformed origins, malformed JSON, incorrect body types/content types, and oversized fixed-length/chunked bodies.
3. Distinct order creation, duplicate/invalid numbers, random invitation format, SHA-256 token storage, and omission of token hashes from returned records.
4. Valid/invalid/expired/revoked invitations; customer profile validation; guest/admin separation; missing, tampered, malformed and expired guest cookies; and public-board field limits.
5. WebSocket handshake denial for missing/expired cookies, cross-site/missing origins, and incomplete profiles.
6. Two-customer presence, movement in both directions, rejected out-of-bounds/coercion payloads, malformed messages, two-way chat, and chat throttling.
7. Preparing → Ready → Served, blocked skips/reversals, idempotent Served timestamp, guest denial of admin updates, public changes, and owner-only personal notifications.
8. Explicit connection replacement and current order status in the new welcome payload.
9. Served grace expiry across idle socket, API, invitation and board.
10. Signed-session expiry and database revocation of idle sockets.
11. Oversized frames closing with 1009 and packet floods closing with 1008.
12. Logout cookie clearing, five-attempt rate limits, concurrent failures, and isolation of client IPs behind the explicitly trusted proxy setting.

The setup test runs only in a temporary directory, verifies generated secret/hash format and 0600 permissions, then verifies a second setup run refuses to overwrite those secrets.

The expiry tests age **temporary** Served records to the actual five-minute boundary and use short-lived signed test sessions. They exercise real timers and the original five-minute formula; they do not wait five wall-clock minutes or twelve hours. Tests assert the server emits no uncaught exception or unhandled rejection.

## Browser observations

- Signed in through `/admin`, created `AUDIT-1001` and `AUDIT-1002`, opened their distinct invitation links, and chose Mochi/Boba profiles.
- Both sessions showed two visitors and visible avatars; keyboard movement reached the other view.
- Messages arrived in both directions. `<b>Plain text only</b>` appeared literally in chat.
- Changing only the first order to Ready updated its personal panel/notice while the second customer's own order remained Preparing.
- Confirmed the dashboard's Served dialog, final state, removal of its transition button, and the owner's Served notification.
- Reopening the first invitation in another tab retained Served status and closed the original visit without reconnect competition.
- Aging that temporary Served record closed the idle visit and rejected its invitation. Dashboard logout returned to the login form.
- Checked the final build's missing/invalid-session page and Closed state after the final header correction.
- No unexpected warnings/errors were captured from the connected customer pages. Expected 401/403 requests during invalid-session tests are not failures.

The browser used `localhost:3100` and `127.0.0.1:3100` to isolate customer cookies, with each page consistently using its own hostname. The browser test server used development cookie settings over HTTP. This is **not** two browser apps/devices or a browser test of production secure cookies. Production cookie flags were verified separately by the integration suite.

Screenshots were saved outside the repository in the session's visualization directory: `chits-audit-chat.jpg`, `chits-audit-ready.jpg`, `chits-audit-served.jpg`, and `chits-audit-closed-final.jpg`.

## Dependency findings

`npm audit` reports 11 high-severity dependency-tree entries originating from two advisories:

- [braces stack-exhaustion denial of service](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), through globbing/build tooling.
- [node-forge RSA signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv), through listhen/tooling.

Both advisory pages list no patched version at the time of review. The 11 entries include inherited reports on Nuxt/Nitro and their dependency ancestors, not 11 distinct application exploits. Neither package was found in the generated `.output/server/package.json`, server module file list, or bundled Nitro chunk search. That artifact inspection narrows the observed exposure; it does not replace a full dependency or deployed-runtime security audit.

No forced Nuxt upgrade or dependency override was applied. npm's suggested Nuxt version change would affect the tested framework tree, and the underlying advisories need reassessment before treating such a change as a security resolution. Keep the development server private and revisit the dependency findings before release.

## Unverified behavior and remaining issues

- No actual HTTPS/WSS reverse-proxy deployment or browser acceptance of production Secure cookies. Nginx syntax alone does not validate TLS, proxy headers, WebSocket routing, or invitation redaction in additional error/monitoring logs. Set `PUBLIC_ORIGIN` to the exact HTTPS origin, keep Node on loopback, and use `TRUST_PROXY=1` only behind the supplied proxy.
- No separate browser-app/physical-phone test, touch/virtual-joystick acceptance, background/network-loss recovery, or prolonged wall-clock expiry soak test.
- No 64-customer/load/backpressure test, distributed abuse test, or persistent rate limiter. One Node process owns the room; restarts clear presence/chat and rate-limit counters. The connection cap is implemented but was not load-tested at its boundary.
- No moderation/mute/kick/report interface. Public chat should remain closed until moderation and security/abuse testing are complete.
- Admin sessions remain stateless: logout clears the browser cookie, but a previously copied signed cookie remains valid until expiry or session-secret rotation. There is no individual server-side admin session revocation or password-reset UI.
- Invitation links intentionally remain reusable bearer credentials while the order is active. There is no revoke/replace-link UI. Database revocation is enforced by API and socket validation and was tested only in the isolated database.
- Backups/restore, deployment automation, monitoring and advanced audit logs remain absent or untested. No production data migration was needed.
- Both avatars spawn at the same entrance until one moves. Furniture collision/pathfinding remains client-side; server movement validates outer bounds, timing and distance, rather than implementing authoritative game physics. Chat cooldown rejections are silent in the current UI, and the board refreshes at up to 30-second intervals when no order-change event arrives.
- The large Phaser client chunk and the dependency audit findings remain unresolved. No art redesign was started.

## Modified-file inventory

All paths below are relative to this project. No other source files were intentionally changed in this audit.

| File | Change |
| --- | --- |
| `.env.example` | Document exact public-origin pinning and explicit trusted-proxy setting. |
| `package.json` | Add typecheck/test commands and development-only `vue-tsc`/`ws`. |
| `package-lock.json` | Record the installed dependency tree and checker/test dependencies. |
| `tsconfig.json` (new) | Reference Nuxt's app/server/shared/Node TypeScript projects. |
| `app/pages/store.vue` | Reconcile reconnect state, handle replacement/expiry, preserve disconnected drafts, refresh board and display Closed. |
| `app/components/GameCanvas.client.vue` | Prevent game creation after asynchronous unmount. |
| `game/createGame.ts` | Fix strict type errors and reconcile the local avatar on a new welcome/session. |
| `server/utils/auth.ts` | Strict cookie/config validation, expiry metadata and shared HTTP/WS origin validation. |
| `server/utils/body.ts` (new) | Bounded streamed JSON-object parsing. |
| `server/utils/room.ts` | Revalidate recipients, expire idle access, retain per-order cooldowns and explicitly replace visits. |
| `server/routes/ws.ts` | Authenticate upgrades, validate payload shapes/types, cap connections/messages and align outer movement bounds. |
| `server/plugins/websocket.ts` (new) | Enforce Node adapter frame-size limits before parsing. |
| `server/middleware/security.ts` (new) | Private-cache/referrer/device-permission/framing/MIME response headers. |
| `server/api/admin/login.post.ts` | Bounded JSON, strict password input, proxy-aware bounded/concurrent failure counts. |
| `server/api/admin/orders/index.post.ts` | Bounded JSON and explicit string validation for order numbers. |
| `server/api/admin/orders/[id].patch.ts` | Bounded JSON, safe IDs and idempotent status updates. |
| `server/api/access/index.post.ts` | Bounded JSON and explicit invitation-token type validation. |
| `server/api/me/profile.post.ts` | Bounded JSON and explicit profile string types. |
| `scripts/setup.mjs` | Atomically refuse to overwrite existing `.env`. |
| `deploy/nginx.conf.example` | Body limit, preserved host/port and invitation access-log omission. |
| `tests/foundation.test.mjs` (new) | Isolated built-server HTTP/WS and setup regression tests. |
| `README.md` | Document checks, deployment settings, actual invitation semantics and remaining work. |
| `docs/LOCAL_TESTING.md` | Preserve the initial smoke-test record and link to the later audit. |
| `docs/FOUNDATION_AUDIT.md` (new) | This evidence, file inventory and remaining issues. |
