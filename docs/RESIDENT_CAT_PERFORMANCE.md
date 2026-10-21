# Browser-only resident cat and walking menu guide

Miming and the walking menu guide now belong to each visitor's Phaser scene. The cat's roaming, sleep, petting, yarn pickup, drag, toss, chase and play are simulated in `game/localMascot.ts` and advanced by the scene's existing `update` loop. The guide's route, idle pauses, turns and tap target remain in `game/createGame.ts`. Neither character writes to SQLite or sends a character WebSocket event. A visitor's pet or yarn action cannot change another visitor's cat. The scene has no extra animation timer; its loop sleeps when the tab is hidden, wakes on visibility, and is destroyed on component unmount. The Phaser component is client-only, dynamically imports the game, and does not put character positions in Vue reactive state.

The menu content remains shared business data. On entry the browser fetches `/api/menu/today` and keeps its date, version and items locally. Tapping the guide or the Menu action opens the dialog immediately with today's cached items. Staff POST, PATCH, DELETE and menu reset save to SQLite, then broadcast a small `menu:updated` event with date and content version. The older `menu_changed` event is also emitted for already-open clients during a rolling deployment. Connected browsers deduplicate by version, refetch if the menu dialog is open, and otherwise wait until the next opening. Reconnect, visibility restoration and Manila midnight also reconcile the cache. The menu is not polled. The order board retains its existing 30-second fallback refresh. Chat, visitor presence and order updates retain their existing socket behavior.

## Local performance evidence

The previous production build, measured just before this change with `node scripts/benchmark-room.mjs`, emitted the cat messages below. The changed build used the same disposable SQLite and socket-count driver on macOS with Node 24.15.0. Each sample lasted 1.2 seconds. The `50` and `100` rows were capped at 40 accepted visitors by the existing room limit. The driver sends three legacy yarn packets per sample; the changed server ignores them. Numbers are received messages summed across all clients, so a broadcast to 40 clients counts 40 deliveries.

| Requested / accepted | Before cat messages/s | After cat messages/s | Before RSS MiB | After RSS MiB |
| --- | ---: | ---: | ---: | ---: |
| 0 / 0 | 0 | 0 | 65 | 66 |
| 1 / 1 | 3.3 | 0 | 66 | 67 |
| 10 / 10 | 33.3 | 0 | 68 | 68 |
| 25 / 25 | 83.3 | 0 | 71 | 70 |
| 50 / 40 | 99.9 | 0 | 78 | 76 |
| 100 / 40 | 133.3 | 0 | 80 | 75 |

The after-build benchmark measured zero total socket messages per second during its idle sample windows, zero mascot messages and 0% sampled server CPU after rounding to 0.1%. It did not measure baseline CPU, sustained throughput, Node event-loop delay or VPS load. RSS is a point-in-time sample and can vary with garbage collection. The former server cat timer and broadcasts were measurable server work; whether they caused the reported severe VPS slowness is not established. Other WebSocket handlers, SQLite operations, proxy configuration and competing VPS processes need production profiling before attributing the slowdown.

An isolated headless Chromium run opened two visitor browsers against a disposable production server. Pet, toss and yarn interaction on one page caused zero HTTP requests and zero character WebSocket frames; neither page received a character frame. Both received one `menu:updated` event after a staff menu edit, displayed the new item, and shared a chat message. No page errors occurred. A 1.1-second `requestAnimationFrame` sample measured about 60 FPS in the 390×844 browser. Guide taps opened the dialog in 33–37 ms across two local runs. These local browser observations are not mobile-device or VPS measurements. An earlier pre-change browser run recorded about 60 FPS and a 7–8 ms guide tap, but used a different interaction harness, so the latency values are not a controlled comparison.

## Validation and remaining checks

`npm run typecheck`, `npm run build`, `npm test` (41 passing), `node scripts/benchmark-room.mjs`, and `git diff --check` passed. Unit tests verify independent cat instances; the socket test verifies obsolete cat packets cannot broadcast while chat still works; the daily-menu test checks versioned staff updates. The existing foundation suite covers public entry, two-visitor presence, movement, chat, order status changes and store availability.

On the actual VPS, compare PM2 CPU, memory, event-loop delay and proxy logs before and after deployment while keeping `.env` and `.data`. On two physical devices, leave the store open for several minutes to observe cat roaming, resting and yarn chase, then pet and toss on only one device and confirm the other remains independent. Tap the moving guide repeatedly, close and reopen the menu, edit the menu from admin, hide and restore a tab, reconnect, and verify chat, presence and live order updates. Check touch drag, reduced motion, background-tab behavior and navigation back into the store on both devices. The 40-visitor room cap remains; a 100-visitor workload requires a separate capacity decision.
