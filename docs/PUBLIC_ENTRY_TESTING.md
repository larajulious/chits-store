# Public entry v0.2 — October 21, 2026

Anyone may choose an avatar and enter. Visitor sessions are independent of orders. There are no invitation requirements, personal order ownership, or Served-based visitor ejections. Admin authentication remains required for order changes and room moderation.

## Structured layout comparison

The reorganized presentation is available at `/?layout=structured` and `/store?layout=structured`. The default routes retain the current design for comparison. Entering, leaving, or returning to avatar selection carries the preview query along; API calls, session validation, avatar IDs, room events and order calculations are unchanged.

The entrance preview separates the welcome/illustration area from a consistent avatar grid, selected-buddy summary and entry button. The store preview separates visitor/connection identity, actual order counts, the existing Phaser scene, and a single four-action navigation bar. Chat and order panels receive matching typography, borders and spacing. No new map artwork or backend behavior was added, and the staff login link remains absent from the public entrance.

Changed files for this presentation pass: `app/components/StructuredEntrance.vue` (new), `app/components/StoreGlyph.vue` (new), `app/pages/index.vue`, `app/pages/store.vue`, and this document. Styles are scoped to the opt-in preview rather than changing shared admin/current-layout styles.

Verification: production build, type check, and all 11 regression tests passed. Browser checks covered 1280×960 desktop and 390×844 mobile viewports, all avatar choices, Palitaw entry, two connected visitors, movement, bidirectional chat, the order panel, Leave preserving the preview route, and the original default entrance. A mobile selection-checkmark sizing issue was corrected and checked again. Tests used a temporary SQLite database and isolated configuration; existing `.env` and `.data` were preserved. Native phone/keyboard/touch acceptance remains pending.

Comparison screenshots in the session visualization directory: `chits-structured-desktop.jpg`, `chits-structured-mobile.jpg`, `chits-structured-store.jpg`, and `chits-structured-chat.jpg`.

## Kakanin avatar update

### Store panel alignment

Updated `app/pages/store.vue` with a consistent title/close-button header, equal-height chat input and Send button, four equal reaction tiles with labels, aligned status groups/counts/wrapping order chips, and consistent paragraph/action spacing in the cashier, chef and seat panels. Shared store-panel styles apply to both store layouts; APIs and room handlers are unchanged.

Build, type check and all 11 regression tests passed. Browser checks on an isolated database covered 390×667 and 320×568 mobile layouts, desktop chat alignment, chat sending, populated Preparing/Ready order groups plus an empty Served group, long order-number wrapping, board refresh, and reaction selection closing its panel. Short screens scroll within the order panel. Physical-device keyboard/touch acceptance remains pending; cashier/chef/seat panels received shared spacing fixes but were not individually exercised in this browser pass. Screenshots: `chits-store-chat-alignment.jpg`, `chits-store-orders-alignment.jpg`, and `chits-store-reactions-alignment.jpg` in the session visualization directory.

### Mobile carousel and mascot consistency

The structured entrance now uses a single horizontally scrollable, snapping avatar row at widths up to 600px. A partial next card, visible scroll indicator and swipe hint expose the additional choices. The selected buddy and entry button remain outside the scroller. The bakery facade has a fixed aspect ratio and proportional roof, windows, sign and door. Desktop retains the full avatar grid.

Mochi, Maja, Boba and Cupcake now use the same SVG mascot treatment as the kakanin, with matching procedural Phaser textures. The shared catalog no longer carries unused emoji presentation fields; saved IDs, colors and visitor validation remain intact.

Changed files for this pass: `app/components/StructuredEntrance.vue`, `app/components/AvatarIcon.vue`, `shared/avatars.ts`, `game/createGame.ts`, and this document. Build, type check and all 11 existing regression tests passed. Browser checks covered the 390×667 and 390×844 mobile layouts, selecting the final offscreen carousel item, the desktop grid, and Boba entry/rendering on an isolated temporary database. A 320×568 layout was inspected and its narrow heading/header wrapping was adjusted; physical-phone swipe, keyboard and touch acceptance remain pending. Screenshots: `chits-mobile-avatar-carousel.jpg` and `chits-avatar-style-desktop.jpg` in the session visualization directory.

Added Palitaw, Biko, Puto, Kutsinta, Suman, Sapin-sapin, Bibingka and Pichi-pichi alongside the original four choices. A shared catalog supplies picker choices, server validation, generated visitor names and Phaser texture IDs/colors. New choices have distinct vector previews and procedural in-game shapes; the existing visitor IDs/storage remain compatible.

For this addition, changed `shared/avatars.ts` (new), `app/components/AvatarIcon.vue` (new), `app/pages/index.vue`, `app/assets/css/main.css`, `game/createGame.ts`, `server/utils/auth.ts`, `server/api/visitors/join.post.ts`, `tests/public-foundation.test.mjs`, and this document. No credential or database configuration changes were made.

Build, type check and all 11 reported tests passed after the addition. The new integration case verifies every kakanin choice saves correctly and gets the right guest name while retaining the visitor ID. Browser checks covered all picker previews at mobile and desktop widths and Palitaw/Biko textures together in the shared room. Physical-device acceptance remains pending. Screenshots: `chits-kakanin-picker.jpg` and `chits-kakanin-multiplayer.jpg` in the session visualization directory.

## Preservation and scope

The existing `.env` and `.data` were preserved. Setup was not run against the installation, and existing admin credentials were not regenerated. Tests use temporary SQLite databases and isolated test configuration. A v0.1-shaped database with a stored order was also tested: visitor-table creation and public joins left that order's fields intact.

The supplied v0.2 snapshot replaced several files from the earlier audit. Historical invitation tests and reports are marked accordingly; they are not current v0.2 acceptance evidence. The architecture remains Nuxt 4.5.2, Phaser 3.90.0 and SQLite, with no paid services or art redesign.

## Local verification

- Dependency installation completed; `vue-tsc` and the WebSocket test client `ws` are development dependencies.
- `npm run typecheck` passed. Strict-index/override errors in the existing Phaser/auth source were corrected.
- `npm run build` passed. The large Phaser chunk warning remains.
- `npm test` passed all 11 reported tests (ten integration scenarios and their wrapper). It selects `tests/public-foundation.test.mjs`, rather than the historical invitation-only suite. It covers all kakanin choices, public avatar entry/re-entry, cookie validation, HTTP/WS origin validation, two-visitor movement/chat, public-safe board fields, protected admin operations, order creation without links, forward-only Ready/Served updates without ejection, moderation, replacement sessions, idle expiry/revocation, oversized/flooded messages, and join rate limits.
- Browser checks used two host-isolated sessions (`localhost:3100` and `127.0.0.1:3100`) against a temporary built server. Both visitors joined without an order, saw both avatars, moved, exchanged chat, and received shared board updates. Staff login, order creation, the chat switch, and the Served confirmation were exercised. Both visitors stayed connected after Served.
- This is not a physical two-device or separate-browser-app test. The browser instance used development cookie settings over local HTTP; production Secure cookie flags and authenticated upgrades are covered at the HTTP/WS integration level, rather than through a deployed HTTPS browser session.
- The revised Nginx example passed an isolated `nginx -t` check; this does not constitute deployment acceptance.

## Narrow fixes made before device testing

- Retained the Phaser background Graphics object; the snapshot destroyed it immediately after drawing and hid the room artwork.
- Restored strict cookie fields, origin checks, bounded JSON bodies, HTTP response protections, and WebSocket frame/message limits removed by the snapshot.
- Recheck signed visitor expiry and database revocation for active/idle sockets and recipients. Presence updates follow removal of expired visitors.
- Malformed JSON and invalid field types no longer throw in the socket handler.
- Explicitly notify replaced tabs so two tabs sharing a visitor cookie do not compete through reconnect loops. Reconnect refreshes the public board and resets the local avatar to its server position.
- Preserve chat cooldown/window state across reconnections. Staff chat disable/mute also blocks reaction messages.
- Apply bounded, cleaned-up login/join attempt tracking. Only an explicitly trusted loopback proxy may supply the client IP. Concurrent login failures count correctly.
- Bound HTTP JSON requests to 4 KiB and Node WebSocket frames to 4 KiB, while retaining the snapshot's 40-person room cap. The cap is not a load-tested capacity claim.
- Served requests are idempotent. Shared Served notices replace the preceding Ready notice. Visitor access is never linked to an order's Served state.
- Prevent asynchronous game creation after component teardown and preserve drafts while disconnected.

## Physical two-device test

At preparation time, the Mac's existing development server listened on port 3000 and its LAN address was `192.168.1.71`. The storefront responded over that address from the Mac. The address can change with network/DHCP changes.

1. Keep the Mac's existing dev server running. Connect both devices to the same Wi-Fi as the Mac.
2. Open `http://192.168.1.71:3000/` on both devices. Use this same LAN hostname throughout; `localhost` on a phone refers to the phone itself.
3. Choose different avatars and enter. Verify two generated guest names, `2 online`, and both avatars after moving apart from the shared entrance.
4. Move with each device's joystick/tap controls. Check that the other device sees movement without large jumps or stuck input.
5. Send a message in each direction and a reaction. Background/reopen one browser, then repeat movement/chat. Check reconnect and visitor counts.
6. On the Mac, sign in at the same LAN URL's `/admin` using the existing password. Create a clearly labeled test order, then move it Preparing → Ready → Served. Both devices should update and remain in the room.
7. Test chat disable/enable and mute/unmute; kick one test visitor and confirm their room exits. Temporary kick permits a deliberate return through the public entrance; it is not a persistent ban.
8. Return through avatar selection or reload, and check that the public entrance still needs no invitation or order.

If a device cannot load the page, first check Wi-Fi isolation, VPN routing and the Mac firewall. No tunnel, public deployment or router configuration change was made. The main server's reachability from another physical device is still unverified.

## Remaining acceptance and security work

- Physical mobile touch, keyboard, portrait layout, background/network-loss recovery and two-device acceptance are pending.
- HTTPS/WSS behind Nginx, deployment, production browser cookie acceptance, 40-user/load/backpressure testing, reporting and persistent bans remain pending. Use one Node process for room state.
- The installed dependency tree still reports 11 high-severity findings from the previously documented braces/node-forge advisories. No forced framework upgrade was applied. Development tooling should remain private; reassess the findings before deployment.
- Moderation and chat settings are in memory and reset on restart. Visitors can deliberately return after a temporary kick or use a new browser session; do not treat these controls as persistent identity bans.
- Login sessions remain stateless; clearing a browser cookie does not revoke a previously copied cookie. Backup/restore and production logging/monitoring remain unverified.
- Visitor creation is limited to 15 requests per minute per IP. A shared NAT address shares that allowance. Existing avatar overlap at the entrance, client-side furniture collisions, and the large Phaser bundle remain prototype limitations.

## Files changed for this v0.2 pass

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | Add checker/test dependencies and scripts for current public tests. |
| `game/createGame.ts` | Background lifetime, strict types and reconnect position reconciliation. |
| `app/components/GameCanvas.client.vue` | Guard asynchronous teardown. |
| `app/pages/store.vue` | Reconnect/replacement handling, board refresh, connection state, draft safety and shared Served notice. |
| `server/utils/auth.ts` | Strict sessions, visitor expiry metadata, origin checks and trusted client address handling. |
| `server/utils/body.ts` (new) | Bounded streamed JSON object parser. |
| `server/utils/room.ts` | Idle/recipient authorization, presence cleanup, replacement messages and retained cooldown state. |
| `server/routes/ws.ts` | Authenticated upgrades, payload validation, flood limits and moderated reactions. |
| `server/plugins/websocket.ts` (new) | Node adapter frame-size limit. |
| `server/middleware/security.ts` (new) | Cache/referrer/framing/MIME/device-permission headers. |
| `server/api/admin/login.post.ts` | Bounded input and robust IP/concurrent-attempt accounting. |
| `server/api/admin/orders/index.post.ts` | Bounded JSON and strict string input; no invitation creation restored. |
| `server/api/admin/orders/[id].patch.ts` | Bounded JSON, valid IDs and idempotence. |
| `server/api/admin/room.post.ts` | Bounded moderation JSON. |
| `server/api/visitors/join.post.ts` | Bounded JSON, strict avatar input and bounded/proxy-aware entry throttling. |
| `deploy/nginx.conf.example` | Request-size limit and preserved Host port. |
| `tests/public-foundation.test.mjs` (new) | Isolated public-entry, compatibility, multiplayer and moderation tests. |
| `tests/foundation.test.mjs` | Mark the historical invitation scenario skipped. |
| `README.md` | Current validation, existing-install instructions, tests and proxy configuration. |
| `docs/FOUNDATION_AUDIT.md`, `docs/LOCAL_TESTING.md` | Mark v0.1 evidence historical. |
| `docs/PUBLIC_ENTRY_TESTING.md` (new) | Current evidence, limitations and physical-device procedure. |
