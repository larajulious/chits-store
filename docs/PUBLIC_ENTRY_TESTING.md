# Public entry v0.2 — October 21, 2026

Anyone may choose an avatar and enter. Visitor sessions are independent of orders. There are no invitation requirements, personal order ownership, or Served-based visitor ejections. Admin authentication remains required for order changes and room moderation.

## Welcome-page store animation

The existing pixel storefront on `/` now has a small chimney with rising puffs, warm window flicker, a softly pulsing sign, and a door that opens occasionally. When closed, its door stays shut and darkens, the windows dim and slowly pulse like sleepy eyes, and small pixel “Z”s drift above the roof. These are CSS-only visual effects and do not change the entrance form or navigation. `prefers-reduced-motion: reduce` stops all motion while keeping the sleeping cues visible.

Files changed: `app/components/StructuredEntrance.vue`, `app/assets/css/pixel-entrance.css`, `README.md`, and this document. Typecheck, production build, all 39 tests, and `git diff --check` passed. Isolated browser checks at 390×844 and 1440×900 confirmed the open-store door and steam animated. In the closed state, the “Z”s moved and windows pulsed while the door stayed still; the entry button remained disabled. Reduced-motion checks showed static “Z”s, windows, and door. Reopening removed the “Z”s and restored the door animation. There were no page errors or horizontal overflows. Screenshots: `chits-home-sleep-mobile.png`, `chits-home-sleep-desktop.png`, and `chits-home-sleep-reduced.png` in the session visualization directory. Physical-device and VPS animation remain unverified.

## In-store board and character size

The in-game Live Orders board now spells out **PREPARING**. Visitor avatars and the walking menu guide render at 1.15×, and the chef and cashier at 1.25×. Floating names sit a little higher; the menu guide enters to the side of the visitor so the larger sprites and labels do not overlap at the doorway. Character coordinates, hit targets, collisions, and network movement remain unchanged. The board still shows up to five Out for Delivery numbers.

Files changed: `game/createGame.ts`, `README.md`, and this document. Typecheck and production build passed. Isolated browser screenshots at 390×844 and 1200×900 showed the full board label and larger characters with no page errors or horizontal overflow. Screenshots: `chits-characters-mobile.png` and `chits-characters-desktop.png` in the session visualization directory. Physical-device and VPS rendering remain unverified.

## Selective admin data reset

**Reset data** in the admin header opens a pixel-styled dialog with five independent choices: today's menu items, all orders and their number counter, all feedback, current in-memory chat, and visitor sessions. The confirmation requires selecting at least one choice and typing `RESET`; it does not ask for the password again. The server requires an admin session and same-origin request, validates the exact choice list, and deletes selected SQLite records in a transaction. Resetting orders makes the next order number 100; resetting visitors disconnects them and preserves SQLite's visitor ID counter so old signed cookies cannot attach to new visitors. The store's open/closed setting, admin credentials, other unselected categories, and menu records from earlier dates remain intact. Connected store clients refresh cleared menus, order boards, feedback, or chat as applicable.

Files changed: `app/components/AdminResetData.vue`, `app/components/AdminChat.vue`, `app/components/AdminFeedback.vue`, `app/pages/admin/index.vue`, `app/pages/store.vue`, `server/api/admin/reset.post.ts`, `server/utils/room.ts`, `tests/admin-reset.test.mjs`, `package.json`, `README.md`, and this document. `npm run typecheck`, `npm run build`, `npm test` (39 passing tests), and `git diff --check` passed. An isolated built-server browser check covered the dialog and confirmation at 1440×900, 390×844, and 320×640, successful reset and subsequent order 100, Escape close, no page errors, and no horizontal overflow. After removing password re-entry, the rebuilt 390×844 dialog was checked again: no password field, successful reset using only `RESET`, no page errors, and no horizontal overflow. The current screenshot is `chits-reset-mobile.png` in the session visualization directory. Production data and credentials were not touched; live VPS and physical-device behavior remain unverified.

## Chef cooking at the stove

The chef now wears a clearer pixel hat and apron and stirs a visible pan at the kitchen stove. Food pieces shift, the pan bobs and steam rises in a short repeating loop. A static pan, utensil and steam remain visible for visitors who prefer reduced motion. The chef's interaction text now matches the ongoing cooking scene, including when no orders are preparing. This is client-side decorative animation; order status and multiplayer positions are unchanged.

Files changed: `game/createGame.ts`, `app/pages/store.vue`, `README.md`, and this document. Validation: `npm run typecheck`, `npm run build`, `npm test` (38 passing tests), and `git diff --check` passed. In an isolated built browser fixture at 390×844, four samples of the stove area produced four distinct normal-motion frames and one identical reduced-motion frame; there were no page errors. Screenshots: `chits-chef-no-preference.png` and `chits-chef-reduce.png` in the session visualization directory. Physical-device rendering and the deployed VPS remain unverified.

## Admin header controls

The admin header places **Close store / Open store**, **Today's menu**, **Reset data**, and **Log out** together. Today's menu opens a keyboard-accessible native dialog for item and price management; the editor no longer occupies the order column. The open/close button replaces the separate availability strip and retains its existing close confirmation and reopen behavior. At mobile widths, the header actions wrap into compact rows. The order queue now uses the freed dashboard space.

Files changed for this layout: `app/pages/admin/index.vue`, `app/components/AdminDailyMenu.vue`, `app/assets/css/admin-dashboard.css`, `app/assets/css/admin-pixel.css`, `README.md`, and this document. `npm run typecheck`, `npm run build` and `npm test` passed (38 tests), as did `git diff --check`. An isolated built-server browser check at 1440×900, 390×844 and 320×844 confirmed the header layout, menu-dialog focus and Escape close, add/edit/remove, close-store confirmation and cancel, successful close and reopen, no horizontal overflow and no page errors. Screenshots: `chits-admin-header-desktop.png`, `chits-admin-header-mobile.png`, `chits-admin-menu-dialog-desktop.png`, and `chits-admin-menu-dialog-mobile.png` in the session visualization directory. VPS and physical-device behavior remain unverified. Existing credentials and production data were left untouched.

## Today's menu and roaming guide

The staff dashboard has a pixel-styled **Today's menu** editor, now opened from the header dialog. Staff can add, rename, reprice and remove items. Prices are stored as integer centavos, and the server assigns the current `Asia/Manila` date; a new empty menu starts each local day. Older menu records remain in SQLite. Each day's list is limited to 30 items. Staff writes require an admin session, same-origin request and bounded JSON input. The public endpoint returns only the date, item names and prices, with no cached response. Connected visitors viewing the menu refresh when staff change it.

A small menu-guide mascot enters from the store doorway, follows walkable paths around the tables, pauses between stops and opens the pixel menu dialog when tapped. The Menu action below the game provides the same view for keyboard and touch users. The guide's optional roaming and sprite animation stop when reduced motion is requested. The NPC is a local scene character; its route is not synchronized across visitor devices and it does not join the WebSocket presence list.

Files modified for this feature: `server/utils/db.ts` (additive menu table), `server/utils/menu.ts` (date, validation and public shape), `server/api/menu/today.get.ts` (public read), `server/api/admin/menu/today.get.ts`, `server/api/admin/menu/today.post.ts`, `server/api/admin/menu/today.patch.ts`, `server/api/admin/menu/today.delete.ts` (staff management), `app/components/AdminDailyMenu.vue` (editor), `app/pages/admin/index.vue` (dashboard placement), `game/createGame.ts` (guide art, walking and tap hit area), `app/pages/store.vue` (live menu dialog and action), `app/components/StoreGlyph.vue` (menu icon), `tests/daily-menu.test.mjs` (isolated API/persistence/WebSocket checks), `package.json` (test command), `README.md` and this document.

Validation actually run: `npm run typecheck`, `npm run build`, and `npm test` passed with **38 tests**, zero failures. The isolated menu test covered authorization, forged origins, malformed and oversized input, exact price storage, public response, live WebSocket notification, restart persistence and date isolation. Separate temporary built server/browser fixtures covered staff add/edit/remove at 1440×900, visitor menu and guide tap at 390×844, live removal while the visitor dialog was open, compact queue visibility, and expanded mobile admin layout. A 320×568 check confirmed the six store actions fit without horizontal page overflow and the menu dialog opens. Browser page errors were empty. Screenshots in the session visualization directory: `chits-daily-menu-admin-compact.png`, `chits-daily-menu-admin.png`, `chits-daily-menu-mobile.png`, `chits-daily-menu-admin-mobile.png`, `chits-menu-guide-mobile.png`, and `chits-daily-menu-narrow.png`. Actual Manila midnight rollover, physical touch devices, and the deployed VPS remain unverified. Existing `.env`, `.data`, credentials and production records were not changed.

## Automatic return to the welcome screen

When an active visit is replaced by another tab, closed by staff, kicked, full, expired, or otherwise loses its valid visitor session, the store now navigates directly to `/` and replaces the history entry. The intermediate **Store entrance** error card and its manual link are gone. The redirect stops reconnect timers, closes the old socket and prevents a second redirect. A direct `/store` visit without a valid session also returns home. The explicit Leave button still uses its confirmation and thank-you dialog.

Modified files: `app/pages/store.vue`, `README.md`, and this document. Validation: `npm run typecheck` and `npm run build` passed. In an isolated built browser session at 390×844, a direct `/store` visit without a session returned to `/`; opening Maja #001 in a second tab returned the original tab to `/` while the new tab stayed connected; closing the store returned the remaining tab to the closed welcome screen with entry disabled. Screenshot: `chits-auto-home-replaced-mobile.jpg` in the session visualization directory. No automated test was added or full integration suite rerun for this client navigation change; the 37-test result below covers the server events that trigger it. Physical-device and VPS behavior remain unverified.

## Staff-controlled store availability

The staff dashboard has a visible Open / Close store control. Closing requires confirmation, blocks new visitor joins and WebSocket entry, returns connected visitors to the closed welcome screen, and disables staff chat sends and visitor feedback submissions while closed. Existing order management remains available. The public welcome screen shows the closed state and disables entry; it checks status every 15 seconds and after a failed attempt. Reopening restores public entry. The state is stored in an additive `store_settings` SQLite table, defaults to open for existing installations and survives restarts. Existing orders, visitor records, `.env`, `.data`, and admin credentials are preserved.

Files modified:

| File | Change |
| --- | --- |
| `server/utils/db.ts` | Add persistent store availability setting without changing existing tables. |
| `server/utils/store.ts` | Read, enforce and update availability. |
| `server/utils/room.ts` | Notify and disconnect live visitors on close. |
| `server/api/store/status.get.ts` | Public, uncached status for the welcome screen. |
| `server/api/admin/store/status.post.ts` | Staff-only, same-origin, bounded JSON state update. |
| `server/api/visitors/join.post.ts` | Block visitor joins while closed. |
| `server/api/me/index.get.ts` | Block direct store re-entry while closed. |
| `server/routes/ws.ts` | Block closed-store WebSocket entry and in-flight messages. |
| `server/api/feedback/index.post.ts` | Block submissions while closed. |
| `server/api/admin/chat.post.ts` | Block staff sends while closed. |
| `app/pages/admin/index.vue` | Status control and closing confirmation. |
| `app/components/AdminChat.vue` | Disable the staff composer while closed. |
| `app/assets/css/admin-pixel.css` | Pixel style for the admin status control. |
| `app/pages/index.vue` | Poll status and handle closed entry. |
| `app/components/StructuredEntrance.vue` | Show closed welcome and disabled entry. |
| `app/assets/css/pixel-entrance.css` | Style closed state. |
| `app/pages/store.vue` | Return current and direct visitors to the closed welcome screen. |
| `tests/store-availability.test.mjs` | Legacy migration, authorization, active sockets, closed gates and restart/reopen coverage. |
| `package.json` | Include availability integration suite. |
| `README.md` | Document staff control and manual acceptance steps. |
| `docs/PUBLIC_ENTRY_TESTING.md` | Record behavior and validation. |

Validation: final `npm run typecheck`, `npm run build` and `npm test` passed, with **37 reported tests** and zero failures. The new isolated suite starts from a legacy SQLite order table, checks default open, rejects unauthorized/forged/invalid changes, confirms two WebSocket visitors receive `store_closed` and disconnect, blocks joins, direct sessions, socket upgrades, feedback and staff chat while closed, then verifies persisted closure after restart and successful reopening. Browser checks on a separate temporary database covered staff login, an active customer, cancelling a close, confirming a close, the visitor thank-you screen, closed welcome and disabled entry, reopening, and the admin control at 390×844. Screenshots: `chits-store-closed-admin.jpg`, `chits-store-closed-welcome.jpg`, and `chits-store-toggle-mobile.jpg` in the session visualization directory. The browser review used page reload to check reopening; the 15-second passive status refresh was source-checked but not timed in the browser. The real VPS and physical devices remain unverified.

## Pixel-styled admin dashboard

The staff login and dashboard now use the store's local Silkscreen font, warm paper palette, subtle pixel grid, square borders, inset edges and offset shadows. Order counts, queue tabs and rows, chat, feedback moderation, room controls, buttons, inputs and the delivery confirmation share that treatment. Body copy remains in Courier for readability. Desktop and mobile keep the existing dashboard structure and actions.

Modified files: `app/assets/css/admin-pixel.css` (new scoped visual layer), `app/pages/admin/index.vue` (include it), `app/components/AdminChat.vue`, `app/components/AdminFeedback.vue`, and this document. No runtime dependencies, credentials or database code changed.

Validation: `npm run typecheck` and `npm run build` passed. An isolated built server with temporary SQLite data and test credentials was used to inspect login and the dashboard at 1440×900 and 390×844. In the browser, the queue button created orders 100 and 101, order 100 advanced to Ready and Out for Delivery, filters showed the expected records, feedback moderation expanded, and the mobile delivery confirmation opened with Cancel focused. Screenshots: `chits-admin-pixel-desktop.jpg`, `chits-admin-pixel-mobile.jpg`, and `chits-admin-pixel-delivery-mobile.jpg` in the session visualization directory. The full integration suite was not rerun for this visual change; the most recent 33-test result is recorded below. Physical-device and VPS appearance remain unverified.

## Create directly from the order queue

Moved **+ Create order** into the Order queue header and removed the separate Create new order card, number placeholder and explanatory block. The queue uses the reclaimed desktop space. The header wraps on narrow screens; the existing creation handler, busy state, automatic numbering, status filters and success/error feedback are preserved. The update time now sits beneath the queue caption on desktop. Removed CSS used only by the deleted card.

Modified files: `app/pages/admin/index.vue`, `app/assets/css/admin-dashboard.css`, and this document. Validation: `npm run typecheck` and `npm run build` passed. On an isolated temporary database, staff login and the relocated button created order 100 at 1440×900 and order 101 at 390×844. Creating from the Delivered filter returned to Preparing. Visual checks confirmed the removed card, header action and expanded queue. Screenshots: `chits-queue-header-desktop.jpg` and `chits-queue-header-mobile.jpg` in the session visualization directory. Test tabs/server/database were removed afterward. No new automated tests were added or full integration suite rerun for this UI relocation; the preceding numbering pass has the 33-test result below. VPS and physical-device checks remain pending.

## Automatic order numbering

Create order now assigns **100, 101, 102…** on the server. Staff do not enter a number. Successful creation shows the assigned number and returns the queue to Preparing. The server ignores caller-supplied number overrides. Existing orders retain their labels, and any number already in use is skipped. The sequence continues across restarts and does not reset each day or reuse an automatically issued number after deletion.

An additive `order_sequence` table stores the next candidate in the existing SQLite file. An immediate transaction allocates the number, inserts the order and advances the counter together. A failed insert rolls back allocation; concurrent creates cannot share a number. Authentication, origin checks, bounded JSON validation and public-order broadcasts remain in place. No credentials, existing orders or production data were reset; no dependencies or paid services were added.

Files modified for automatic numbering and the keyboard fix in this development pass:

| File | Change |
| --- | --- |
| `server/utils/db.ts` | Add the persistent sequence table. |
| `server/api/admin/orders/index.post.ts` | Assign numbers atomically from 100 and skip occupied labels. |
| `app/pages/admin/index.vue` | Replace manual entry with automatic assignment and use the returned number in confirmation. |
| `app/assets/css/admin-dashboard.css` | Style the automatic-number display within the existing responsive form. |
| `tests/order-numbering.test.mjs` | New isolated integration coverage for allocation, authorization, concurrency, rollback and restart. |
| `tests/public-foundation.test.mjs` | Create orders without a supplied number and assert the first assigned number. |
| `package.json` | Include the numbering suite in `npm test`. |
| `game/createGame.ts` | Stop movement-key capture from consuming native typing and suspend controls during input. |
| `app/components/GameCanvas.client.vue` | Pass and watch the controls-enabled state; clear joystick input. |
| `app/pages/store.vue` | Suspend game controls while store panels are open or leaving. |
| `README.md` | Document automatic numbering and update the manual test instructions. |
| `docs/PUBLIC_ENTRY_TESTING.md` | Record changes, executed checks and acceptance limits. |

Validation: `npm run typecheck`, `npm run build` and `npm test` passed, with **33 reported tests**, zero failures and zero skips. The new numbering suite starts with an isolated legacy CHECK-constrained database containing order 101: creation assigns 100 then 102, twelve concurrent creates assign 103–114, a forced insert failure preserves the counter, retry assigns 115, and restart/deletion checks continue through 117. It also rejects anonymous/visitor requests, forged origins and invalid/oversized bodies without allocating numbers, ignores caller overrides and preserves the legacy record. Existing multiplayer, chat, status, feedback and production-start suites pass.

Browser checks used a separate temporary database and test credentials. At 1440×900, staff login succeeded and two admin tabs created 100, 101 and 102 without manual entry. Creating while the Delivered filter was selected returned to Preparing. At 390×844, the stacked form created 103 successfully. Screenshots: `chits-auto-order-desktop.jpg` and `chits-auto-order-mobile.jpg` in the session visualization directory. Test tabs/server/database were removed afterward. The existing dev server and real `.env`/`.data` were left in place.

VPS deployment, physical-device interaction, mobile soft keyboards and IME composition remain unverified. The UI still shows the latest 100 orders; the allocation counter considers all existing labels, not only those shown in that list. The numbering sequence is global and persistent, not a daily reset.

## Keyboard entry in chat and feedback

Reproduced the reported failure with real browser key presses: typing `palitaw` into chat produced `plit`. Phaser's default `addKeys` capture called `preventDefault` for W/A/S/D and arrows at the window level. The existing update-loop input guard stopped avatar movement but could not restore cancelled native typing.

Movement keys are now registered without global browser-event capture. Arrow scrolling is prevented only when the game is accepting movement input. Game controls pause while a store panel is open; held-key state, joystick direction and pending walk paths are cleared on pause/resume. Focused inputs, textareas, selects, contenteditable elements, textbox roles, composition and native dialogs also keep movement from consuming typing or continuing underneath the UI. Idle character animation and incoming room updates continue.

Modified files: `game/createGame.ts`, `app/components/GameCanvas.client.vue`, `app/pages/store.vue`, and this document.

Validation: build, type check and all 27 existing tests passed. Isolated browser checks used actual key presses rather than relying on `fill`: chat accepted `palitaw wasd WASD` and `awsdAWSD`, arrow-left insertion/backspace worked, Enter sent the complete chat message, and feedback accepted `palitaw wasd` followed by a newline and `WASD` and submitted successfully. The same lower/uppercase movement letters and multiline editing worked at 390×844. Holding W after closing a panel moved the avatar again. Desktop checks used 1280×900. Screenshots: `chits-chat-keyboard-typing.jpg`, `chits-feedback-keyboard-typing.jpg`, `chits-feedback-keyboard-mobile.jpg`, `chits-keyboard-before-walk.jpg`, and `chits-keyboard-after-walk.jpg` in the session visualization directory. Actual mobile soft keyboards, IME composition and VPS deployment remain unverified.

## Admin queue without Active

Removed the combined Active filter from the admin queue. The four filters are now Preparing, Ready, Out for Delivery and Delivered. The page defaults to Preparing; creating an order returns to Preparing so the new order appears immediately. Table captions and empty messages use the selected status directly. Summary counts and the existing order-transition handlers remain in place.

Modified files: `app/pages/admin/index.vue`, `README.md`, and this document. Validation: `npm run typecheck` and `npm run build` passed; a source check confirmed no Active filter/branch remains in the admin page. No tests were added for this small UI removal. Browser and VPS verification were not repeated. Older sections below retain the Active terminology used at that time.

## Separate Delivered step (current order workflow)

The current flow is **Preparing → Ready → Out for Delivery → Delivered**. Earlier label-only/final-status sections below are historical. Out for Delivery orders now have a **Mark delivered** action and remain in Active. A focused native HTML confirmation dialog asks staff to confirm that the order reached the customer; Cancel preserves the status, while Confirm delivered completes it. Delivered has its own summary, queue filter, row badge and completed state. Mobile summary cards use a two-by-two grid.

Customer notices and the full Orders panel distinguish Delivered from Out for Delivery. The small Phaser chalkboard still lists up to five Out for Delivery orders; completed orders leave that list. Out for Delivery orders no longer expire after five minutes. The public board's existing five-minute final-state visibility window now starts at delivery completion; admin history retains the order.

Storage is additive: `delivered_at` is added if absent, within a SQLite transaction. The existing orders table and its three-value status CHECK are not rebuilt. `Served` retains its existing Out for Delivery meaning; `Served` plus a completion timestamp serializes as `Delivered` in API responses. Existing `served_at`, order details, `.env`, `.data` and admin credentials are preserved. No old orders are automatically completed. Shared next-status rules enforce the sequence on the client and server. Completion retries preserve timestamps; skipping stages, reversing a final status, invalid/null final-status payloads, unauthorized callers and forged origins are rejected.

Modified files:

| File | Change |
| --- | --- |
| `shared/order-status.ts` | Four visible statuses, shared status type and next-step rules. |
| `server/utils/db.ts` | Additive completion timestamp migration and API status derivation. |
| `server/api/admin/orders/[id].patch.ts` | Forward-only completion, terminal validation and timestamp handling. |
| `server/api/orders/board.get.ts` | Keep deliveries active; expire completed records from the public feed after five minutes. |
| `app/pages/admin/index.vue` | Mark delivered, focused confirmation, Delivered count/filter and Active semantics. |
| `app/assets/css/admin-dashboard.css` | Four summary cards, mobile two-by-two layout and confirmation styles. |
| `app/pages/store.vue` | Delivered group, badge and shared completion notice. |
| `game/createGame.ts` | Accept the shared four-status public order type. |
| `tests/public-foundation.test.mjs` | Legacy CHECK-constrained migration, complete workflow, both visitors' events, idempotence, authorization and final board window. |
| `README.md` | Current workflow and admin/customer behavior. |
| `docs/PUBLIC_ENTRY_TESTING.md` | Verification, file inventory and migration notes. |

Validation: `npm run typecheck`, `npm run build` and all **27 reported tests** passed. The integration suite now starts from a legacy table whose CHECK permits only Preparing/Ready/Served, preserves old record fields, and verifies all four stages reaching two connected visitors without ejection. It checks skip/reverse/invalid/null transitions, scope/origin restrictions, retry idempotence, preservation of dispatch timestamps, legacy in-flight records remaining public, and five-minute completion expiry while admin history remains available. Other multiplayer/chat/feedback/startup regressions also pass.

Browser checks on an isolated temporary legacy database covered staff login, a preexisting hour-old Out for Delivery order, creating a fresh order, Mark ready → Send out → Mark delivered, initial focus on Cancel, cancellation with unchanged counts/status, confirmation, Active/Out for Delivery/Delivered filters, updated counts, public Delivered grouping and customer notice. Existing legacy deliveries could also be completed through the admin UI. Desktop admin (1440×900), mobile admin (390×844) and customer mobile (390×844) layouts were checked. The mobile admin count cards and Delivered queue filter were also exercised. Screenshots: `chits-delivered-stage-admin.jpg`, `chits-delivered-stage-admin-mobile.jpg`, and `chits-delivered-stage-customer.jpg` in the session visualization directory.

Remaining checks: VPS deployment, physical devices, sustained load and a live five-minute wait. The expiry boundary is tested with isolated timestamps rather than waiting five minutes. Staff/customer lists retain the existing latest-100 limit.

## Gentle character animation

In-store visitor avatars, the chef and the cashier now have gentle breathing and occasional blinks. Local and remote visitors add a small squash/stretch, hop and lean while moving, then return to idle. Each character has a staggered phase to avoid moving in unison. Closed-eye textures are generated from the existing pixel artwork; the open-eye artwork and welcome-screen icons are preserved. Body scale, angle and render origin carry the animation; logical x/y, pathfinding, collision bounds, labels and network positions remain separate. Remote walking starts only when that visitor's actual target position changes, so another customer's update does not make an idle avatar walk.

`GameCanvas.client.vue` reads the browser's reduced-motion preference and listens for changes. When reduction is enabled, the optional breathing/blinking/bounce/lean stop for visitors and staff; core position interpolation remains. The preference listener is removed on unmount, and the Phaser scene owns its textures and rendering lifecycle. No new assets, dependencies, servers or paid services are required.

Modified files: `game/createGame.ts`, `app/components/GameCanvas.client.vue`, `README.md`, and this document. Existing `.env`, `.data` and credentials were preserved.

Validation: `npm run typecheck`, `npm run build` and all 26 existing tests passed. Browser checks on an isolated temporary database/server used Palitaw and Biko in two connected customer sessions at 1280×900 and 390×844, plus a temporary staff login. Verified tap-to-move, remote movement, return to idle, visitor speech and staff speech above the cashier, and walking up to the physical feedback box. Ten idle screenshots sampled 450ms apart showed changing appearances while the characters remained at rest; cropped comparisons found five distinct Palitaw, five Biko, eight chef and five cashier samples. Screenshots include `chits-character-idle-0.jpg` through `chits-character-idle-9.jpg`, `chits-character-walk-mobile.jpg`, `chits-character-walk-remote.jpg`, and `chits-character-motion-staff-bubble.jpg` in the session visualization directory.

The reduced-motion path/listener and unchanged movement-coordinate calculations were source-checked. A live OS preference toggle, all twelve avatars individually, physical-device performance and VPS deployment were not tested in this pass. Browser stills record sample poses; the 26 automated tests cover existing functional behavior rather than animation appearance.

## Feedback wording update

Removed customer-facing approval language from `app/components/FeedbackBox.vue`: the introduction, loading/empty states, submission success message and post footer no longer mention staff approval. The submit button now says “Send feedback.” The community board retains its ten-hour visibility note. Backend staff moderation and expiry behavior are unchanged. The technical/history sections below describe that implementation, not current customer-facing copy.

Modified files: `app/components/FeedbackBox.vue` and this document. Validation: production build and type check passed; source checks confirmed no approval wording remains in the customer feedback component. No new tests were added for this copy-only change; browser and VPS checks were not repeated.

## Moderated suggestions and reviews (10-hour visibility)

Visitors can tap a pixel feedback box near the entrance (the avatar walks over before opening it), or use the accessible Feedback action. The form accepts Suggestion or Review, up to 500 characters, explains staff approval and the ten-hour window, and retains failed-send text while open. Approved posts show their type, guest nickname, content and remaining visibility in the Community board. The public board and each staff queue return at most 50 posts. The feedback dialog header stays available while scrolling on short screens.

Authenticated staff use **Customer feedback** beside chat to review the Pending queue, Approve or Reject, view Published posts and Hide a published post. Pending posts are private. Publication lasts exactly **10 hours from staff approval**; retrying approval cannot renew that window, and rejected/hidden posts cannot be reapproved. Expiry timestamps are stored in the existing SQLite file, survive restarts and are filtered by the server. A server-time-adjusted client clock also removes expired posts from an already open board. Moderation broadcasts `feedback_changed` to refresh connected open boards; a 30-second public poll and 15-second staff poll provide fallback refreshes.

The additive `feedback` table and indexes preserve existing orders and visitors. `.env`, `.data` contents and admin credentials were not reset; no paid services or new dependencies were introduced. Pending, rejected and expired records remain in SQLite; ten-hour visibility is not automatic deletion. The rejection/expiry data is not offered in the public feed. Submission identity, status and timestamps are assigned by the server, and content is rendered as plain text. Reads/submissions require a valid visitor session; staff listing/moderation requires admin scope, and mutations enforce same-origin and bounded JSON validation. Persistent visitor limits allow three submissions per rolling hour and require one minute between submissions. A bounded in-memory address limiter allows ten submissions per hour per address; that additional address limit resets on restart. The existing trusted-proxy address handling applies.

Modified files:

| File | Change |
| --- | --- |
| `shared/feedback.ts` | Shared public/admin types and visibility/text limits. |
| `server/utils/db.ts` | Additive feedback table and indexes. |
| `server/utils/feedback.ts` | Validation, safe feeds, submission limits, moderation and persisted expiry. |
| `server/api/feedback/index.get.ts` | Authenticated visitor feed of approved, unexpired posts. |
| `server/api/feedback/index.post.ts` | Visitor submissions to the private pending queue. |
| `server/api/admin/feedback/index.get.ts` | Protected staff queues and pending count. |
| `server/api/admin/feedback/[id].patch.ts` | Protected approve/reject/withdraw actions and refresh broadcast. |
| `app/components/FeedbackBox.vue` | Pixel form, success/error states, approved board and live expiry. |
| `app/components/AdminFeedback.vue` | Collapsible staff moderation panel beside chat. |
| `app/components/StoreGlyph.vue` | Pixel feedback-box icon. |
| `app/pages/store.vue` | Feedback action, modal and live moderation refresh. |
| `app/pages/admin/index.vue` | Mount the feedback moderation panel for authenticated staff. |
| `game/createGame.ts` | Pixel box, collision boundary and walk-up interaction. |
| `tests/feedback.test.mjs` | Isolated authentication, moderation, expiry, restart and rate-limit integration coverage. |
| `package.json` | Include feedback tests in `npm test`. |
| `README.md` | Describe feedback use, visibility and local retention. |
| `docs/PUBLIC_ENTRY_TESTING.md` | File inventory, verification and limits. |

Validation: `npm run typecheck`, `npm run build` and all **26 reported tests** passed (18 existing and the new feedback suite with seven scenarios plus its wrapper). Integration checks cover anonymous/wrong-scope/forged-origin denial, malformed and oversized input, server-assigned identity/status/time, pending privacy, exact ten-hour timestamps, idempotent approval, broadcast refresh, approval/session persistence through restarts, rejected/withdrawn/expired post exclusion, prevention of expiry renewal, persistent visitor limits, address limits and revoked sessions. Existing order/multiplayer/chat/startup tests also pass, including preserving a legacy order across additive table creation.

Browser checks used only an isolated temporary database/server: staff login, two customer sessions, mobile suggestion submission, physical-box walk-up and review submission, pending privacy, staff approval, approved posts reaching both customers, literal HTML-looking text, staff withdrawal/rejection, rate-limit errors retaining drafts, and countdown expiry in an open panel using a deliberately shortened fixture timestamp. Desktop (1440×900 admin / 1280×900 store), mobile (390×844) and narrow mobile (320×568) layouts were checked. Screenshots in the session visualization directory: `chits-feedback-store-box.jpg`, `chits-feedback-staff-review.jpg`, `chits-feedback-approved-desktop.jpg`, `chits-feedback-approved-mobile.jpg`, and `chits-feedback-small-mobile.jpg`.

Unverified: a ten-hour real-time soak, physical-device touch/keyboard and production VPS deployment. Automated expiry tests shorten stored fixture timestamps rather than waiting ten hours. General public chat load/moderation acceptance and the earlier VPS visitor-join HTTP 500 still need production evidence. Large queues are capped at the latest 50 records per list; expired/rejected record cleanup and pagination are not implemented.

## Leave confirmation and thank-you message

The public store's Leave button opens a pixel-styled native modal asking “Are you sure you want to leave Chits Meryenda Hub?” The initial focus is on “Stay a little longer”; cancelling closes the modal and returns focus to Leave. “Yes, leave” returns to the welcome screen, where a one-time dialog says “Thank you for visiting Chits Meryenda Hub!” with a “See you soon!” dismiss button. In-memory Nuxt state carries and consumes the thank-you flag without changing the URL or adding persistent storage. Existing page teardown closes the WebSocket and removes visitor presence after confirmed navigation. The native modal supplies focus containment and Escape dismissal; pending navigation blocks duplicate confirmations and dismissal.

Modified files: `app/components/VisitDialog.vue` (new shared confirmation/thanks modal and pixel styles), `app/pages/store.vue` (Leave confirmation and guarded navigation), `app/pages/index.vue` (consume and display thank-you), `README.md`, and this document. Existing `.env`, `.data` and admin credentials were preserved.

Validation: `npm run typecheck`, `npm run build` and all 18 existing tests passed. Browser checks used an isolated temporary server/database and two customer sessions at 1280×900 and 390×844. Verified clean initial entry, confirmation layout and initial focus, cancelling with the visitor still connected and focus restored, confirming to `/`, the thank-you message and dismiss action, presence dropping from two to one in the other session, no repeated thank-you after refresh, and successful re-entry. Desktop confirmation/thank-you and mobile confirmation/thank-you flows were exercised. Native Escape behavior and pending-navigation failure recovery were source-checked, not separately browser-exercised. This confirmation covers the app's Leave button; browser Back, tab close and external navigation were not changed. Physical-device and VPS acceptance remain unverified. Screenshots: `chits-leave-confirm-desktop.jpg`, `chits-leave-confirm-mobile.jpg`, and `chits-visit-thanks-mobile.jpg` in the session visualization directory.

## Staff speech above the cashier

Live chat events with the server-assigned `staff` role now show their message above the cashier NPC and stay in the customer chat feed with the STAFF badge. Customer messages/emotes retain their avatar bubbles. The cashier bubble wraps the full staff message (up to 160 characters), including unbroken text, and lasts 5–9.6 seconds according to message length. A new staff message replaces the previous cashier bubble and cancels its expiry timer. A staff event received while the game is loading is retained until the game is ready. Phaser owns the bubble and timer lifecycle.

Modified files: `game/createGame.ts` (cashier reference, separate staff bubble/timer and game API), `app/components/GameCanvas.client.vue` (exposed staff bubble method and startup queue), `app/pages/store.vue` (route verified staff events to the cashier), `README.md`, and this document. No authentication, chat transport, moderation, persistence, environment or credential changes were made.

Validation: `npm run typecheck`, `npm run build`, and all 18 existing tests passed. An isolated temporary server/database supported one admin and two connected customer browser sessions at 1280×900 and 390×844. Staff messages appeared above the cashier in both sessions and in the STAFF chat feed; short, long and 160-character unbroken messages were checked. Customer chat continued to show above the customer avatar. Expiry was visually checked between sends; the replacement timer cancellation was source-checked. Existing integration tests cover the server-assigned role and visitor spoof prevention. Startup queuing and teardown were source-checked; a deliberately delayed game startup was not browser-tested. Screenshots: `chits-cashier-staff-bubble-desktop.jpg` and `chits-cashier-staff-bubble-mobile.jpg` in the session visualization directory. Physical devices and VPS deployment remain unverified.

## Five deliveries on the in-game board

The in-game Live Orders chalkboard now lists up to five Out for Delivery order numbers in the public feed's newest-first order, with one number per line. Preparing and Ready retain their existing latest-order summaries. The chalkboard is slightly taller and uses compact text to fit all five delivery rows; maximum-length order numbers fit within its inner width. An empty delivery list shows a dash. The Orders dialog retains the full public feed. Authentication, persisted status keys, API limits, board expiry, `.env`, `.data` and credentials are unchanged.

Modified files: `game/createGame.ts`, `README.md`, and this document.

Validation: `npm run typecheck`, `npm run build` and all 18 existing tests passed. Browser checks against a temporary isolated database at 1280×900 and 390×844 used six delivery orders, including a 24-character number, plus Preparing/Ready orders. The canvas showed the newest five deliveries, excluded the sixth, and kept the text inside the board. The Orders dialog still showed all six delivery orders. Screenshots: `chits-live-orders-five-desktop.jpg` and `chits-live-orders-five-mobile.jpg` in the session visualization directory. Physical-device and VPS acceptance were not repeated.

## Out for Delivery label (current)

The visible flow is now **Preparing → Ready → Out for Delivery**, replacing the earlier Delivered wording documented below. Admin summaries, filters, badges, accessible actions, confirmation and feedback, the public order panel, customer notices, the initial/live Phaser board and transition error copy use the updated status. Ready orders have a compact “Send out” action; dispatched rows say “On the way.” The longer badge wraps in narrow table cells, and the game board places its delivery order number on a separate line.

This is a presentation change. SQLite/API status `Served`, `served_at`, forward-only transitions, the final confirmation, Active filter behavior and existing five-minute public-board retention for the final status remain unchanged. Existing records require no migration; `.env`, `.data` and admin credentials were preserved.

Modified files: `shared/order-status.ts`, `app/pages/admin/index.vue`, `app/assets/css/admin-dashboard.css`, `app/pages/store.vue`, `game/createGame.ts`, `server/api/admin/orders/[id].patch.ts`, `README.md`, and this document.

Validation: `npm run typecheck`, `npm run build` and all 18 existing tests passed. Browser checks on an isolated temporary database covered admin login, the new summary/filter/badge/action wording at 1280×720 and 390×844, public visitor entry, the Phaser board and the populated customer order panel. The retained native final confirmation and live notification wording were source-checked; their browser execution was not repeated. Physical devices and VPS deployment remain unverified, including the earlier production join error pending server logs. New screenshots: `chits-out-for-delivery-desktop.jpg`, `chits-out-for-delivery-mobile.jpg`, and `chits-out-for-delivery-orders.jpg` in the session visualization directory. Historical sections below retain the wording used when they were tested.

## Desktop admin workspace

The admin dashboard now uses a wide, two-column workspace: creation and the order queue on the left, customer chat and collapsible moderation on the right. At desktop sizes starting at 1100px wide and 700px high, the workspace fits the viewport, with separate order/message scrolling and a visible chat composer. Smaller screens stack the sections; the narrow order table scrolls horizontally to preserve readable action columns.

Preparing, Ready and Delivered summaries and Active/Preparing/Ready/Delivered queue filters derive from the existing endpoint's latest 100 records. They are explicitly labeled as recent-order counts, not all-time or daily totals. Active includes Preparing and Ready; Delivered records stay available in their filter. The existing final Delivered confirmation and server transitions are retained. Per-order pending state prevents repeated status actions. Creation returns to Active, errors/success feedback remain visible above the workspace, and page actions keep the chat component mounted so drafts survive order operations. Header controls provide refresh, Storefront and logout.

Changed files: `app/pages/admin/index.vue` (layout, derived filters/counts, refresh/pending/feedback state), `app/assets/css/admin-dashboard.css` (new scoped desktop/responsive styles), `app/components/AdminChat.vue` (shorter explanatory text for the workspace), `README.md`, and this document. No API, authorization, database/schema, moderation or chat-transport changes were made. Existing `.env`, `.data`, credentials and order records were preserved.

Validation: build, type check and all 18 existing tests passed. An isolated temporary database with seeded Preparing/Ready/Delivered orders supported browser checks at 1440×900, 1280×720 and 390×844. Verified login, creating an order, clicking Mark ready, resulting counts and next-step labels, Ready/Delivered/Active filters, completed rows, chat draft survival across creation/status/filter changes, customer question → admin, admin reply → customer STAFF badge, and mobile queue/composer layout. The existing native Delivered confirmation was retained and source-checked; this layout pass did not repeat its browser acceptance. Server-side Ready → final status remains covered by integration tests. Physical-device keyboard/touch, public load and VPS deployment remain unverified.

Screenshots (temporary test data): `chits-admin-workspace-desktop.jpg`, `chits-admin-workspace-compact.jpg`, and `chits-admin-workspace-mobile.jpg` in the session visualization directory.

## Admin-to-customer community chat

The admin dashboard now includes a Customer chat card. Authenticated staff can read customer messages and send replies into the existing public Community Chat. Customers see replies from “Chits Store” with a STAFF badge. This is a shared public conversation, not private messaging or a chef/cashier announcement feature.

The admin card fetches the bounded, in-memory conversation every two seconds and after a successful send; customer delivery uses the existing authenticated WebSocket broadcast. No staff avatar or additional room member is created. The latest 50 messages remain in memory and clear on restart; no schema or credential changes were made. Polling stops when the component unmounts or the admin session expires. Drafts survive failed sends, stale poll results cannot replace a newer send response, and the view only follows new messages when already near the bottom or after sending.

Both admin chat endpoints require the admin cookie. Sends additionally enforce the existing origin and bounded-JSON checks, normalized plain text of 1–160 characters, a 1.5-second cooldown and 20 messages per minute shared across staff tabs. Public chat pause applies to staff sends too. Sender identity/role are assigned by the server; visitor WebSocket messages cannot set themselves to staff. Text is rendered through Vue interpolation, including text that looks like HTML. The existing moderation member list still uses its Refresh visitors control.

Changed files:

- `shared/chat.ts` (new): message and admin snapshot types.
- `server/utils/room.ts`: bounded temporary history and shared publish function.
- `server/routes/ws.ts`: publish visitor chat with a verified visitor role.
- `server/api/admin/chat.get.ts` and `server/api/admin/chat.post.ts` (new): protected history and staff sending.
- `app/components/AdminChat.vue` (new): polling, composer, status, draft/scroll handling and lifecycle cleanup.
- `app/pages/admin/index.vue`: mount chat only in the authenticated dashboard.
- `app/pages/store.vue`: render staff identity and retain visitor avatar speech bubbles.
- `app/assets/css/pixel-store.css`: staff badge styling.
- `tests/public-foundation.test.mjs`: three integration scenarios covering protected access, validation, bidirectional delivery, roles, rate limits and paused chat.
- `README.md` and this document: feature behavior and validation record.

Validation: build, type check and all 18 reported tests passed. Isolated browser checks covered temporary staff login, customer question → admin feed, admin reply → customer STAFF badge, pause disabling send while retaining a draft, desktop/mobile (390×844) composer alignment, and logout removing the chat. Screenshots: `chits-admin-customer-chat.jpg`, `chits-customer-staff-reply.jpg`, and `chits-admin-chat-mobile.jpg` in the session visualization directory. Physical-device keyboard/touch and VPS delivery remain unverified. The prior live visitor-entry HTTP 500 is a separate deployment issue still awaiting VPS logs. Existing `.env`, `.data`, admin credentials and order behavior were preserved.

## VPS production startup

An isolated raw production launch with no signing key reproduced `POST /api/visitors/join` returning HTTP 500 with the generic “Server Error” response; its server log identified the missing `SESSION_SECRET`. This is a demonstrated deployment failure mode, not a confirmed diagnosis of the user's VPS, whose error log and launch method have not been supplied.

Added `npm start`, which loads an existing `.env` without replacing process-manager values, enforces production cookie mode, validates the existing signing key and admin hash, and then starts the built server. The PM2 example uses that launcher in a single fork. Existing credentials and databases are never regenerated. Build/install on the VPS under Node 24+ to produce Linux-compatible SQLite bindings, use a persistent writable SQLite directory, and configure the supplied Nginx proxy with HTTPS and WebSocket forwarding. See README's VPS instructions.

Changed files: `scripts/start.mjs` (new), `package.json`, `deploy/pm2.ecosystem.cjs`, `tests/production-start.test.mjs` (new), `README.md`, and this document. The four new tests cover missing signing key, missing admin hash, production entry/session/admin login after loading `.env`, secure cookies despite a development value in the file, and process-manager signing-key precedence. Tests use temporary configuration/databases and stop servers before removing test data.

Validation: build, type check, all 15 tests (the existing 11 plus four startup cases), launcher/test syntax and the PM2 single-process launcher configuration passed locally. No connection to, modification of, or deployment on the VPS was performed; live HTTPS, cookies, SQLite permissions/native bindings, origin routing and WSS still require confirmation there.

## Delivered label

The visible final status is now **Delivered**: the admin badge/action/confirmation, public order section and accessible label, delivery notification, initial/live Phaser board text, and forward-transition error message use the new wording. The workflow reads Preparing → Ready → Delivered. Existing SQLite/API keys (`Served`, `served_at`) and final-state/idempotence rules are retained, so stored orders need no migration.

Changed files: `shared/order-status.ts` (new shared labels), `app/pages/admin/index.vue`, `app/pages/store.vue`, `game/createGame.ts`, `server/api/admin/orders/[id].patch.ts`, `README.md`, and this document. This is a text-presentation change; historical reports below retain the terminology used when those tests ran.

Validation for the rename: build, type check and all 11 existing integration tests passed, including persisted-order compatibility and forward-only terminal transitions. Visible bindings/text were source-checked; this wording-only pass did not repeat the browser/device acceptance tests. Existing data and credentials were untouched.

## Structured layout is now the default

The structured pixel entrance and store are now the only public layouts at `/` and `/store`. Removed the old entrance, old store header/navigation, query-driven layout selection and their unused CSS. Entry, Leave and session-recovery links use clean routes. Existing URLs with `?layout=structured` still render the same layout, but navigation no longer adds that parameter.

Changed files for this removal: `app/pages/index.vue`, `app/pages/store.vue`, `app/assets/css/main.css`, `app/assets/css/pixel-store.css`, `README.md`, and this document. Shared admin styles and the storefront illustration styles still used by the structured entrance are retained. Authentication, multiplayer, order handling, `.env`, `.data` and credentials are unchanged. The presentation passes recorded below describe their historical preview state.

Validation for the default switch: build, type check and all 15 regression/startup tests passed. Browser checks on an isolated database covered direct `/store` without a session and its clean recovery link, Palitaw selection/entry at `/` → `/store`, connected game rendering, chat sending, the Preparing/Ready/Delivered board, reaction selection, Leave → `/`, mobile welcome at 390×667, and compatibility with an old preview URL. The existing dev server also renders the structured entrance directly at `/`. Physical-device and VPS acceptance were not repeated; the earlier live entry HTTP 500 remains a separate deployment issue pending VPS logs.

### Pixel presentation pass

The structured entrance and in-store panels now use square controls, stepped panel frames, hard shadows, pixel icons and locally bundled Silkscreen lettering. Chat messages/input and longer explanatory text retain readable monospace type. Both store navigation variants use pixel icons. The welcome keeps its existing mobile carousel and the in-store label remains “INSIDE THE MERYENDA HUB”. Default entrance layout selection is unchanged.

The four reaction drawings share integer-grid rectangles between their SVG picker icons and Phaser textures, so the sender and other visitors see the same pixel reaction bubble. Their existing emoji WebSocket values and moderation behavior are unchanged. Avatar drawings receive crisp edge rendering; no map, physics, authentication or storage redesign was introduced.

Changed files in this pass:

- `app/assets/css/main.css`: local font declaration.
- `app/assets/css/pixel-store.css` (new): store controls, modal, badges, chat, board and reaction styling.
- `app/assets/css/pixel-entrance.css` (new): structured welcome styling.
- `app/components/StructuredEntrance.vue`: load its scoped pixel stylesheet.
- `app/components/StoreGlyph.vue`: integer-grid interface icons.
- `app/components/AvatarIcon.vue`: crisp SVG edge rendering.
- `app/components/PixelReaction.vue` (new): SVG renderer for shared pixel reaction art.
- `app/pages/store.vue`: load scoped styles, use shared reactions and pixel navigation icons.
- `shared/reactions.ts` (new): four drawings and unchanged wire values.
- `game/createGame.ts`: generate reaction textures and display them in self/remote bubbles while retaining the existing lifetime/cleanup behavior.
- `app/assets/fonts/Silkscreen-Regular.ttf` (new) and `public/licenses/OFL-Silkscreen.txt` (new): self-hosted font and its required license. Source: [Google Fonts Silkscreen](https://github.com/google/fonts/tree/main/ofl/silkscreen); upstream [font project](https://github.com/googlefonts/silkscreen). No runtime font-service requests or new package dependencies.
- `docs/PUBLIC_ENTRY_TESTING.md`: this inventory and validation record.

Verification: build, type check and all 11 existing regression tests passed. A direct Node assertion also checked all reaction rectangles stay within their 16×16 grid and keep the four supported wire values. Browser checks used an isolated temporary SQLite database: mobile entrance, chat sending, populated order groups/refresh, reaction selection and sender/recipient pixel bubbles with two sessions, plus chat and emotes at 320×568. Desktop game rendering and the welcome at 1280×720 were checked. The font moved into Vite's bundled assets after the running development server returned fallback HTML for a newly added public font path; the final font URL returns `font/ttf`, and the production output includes the font and its license. Physical-device touch/keyboard acceptance remains pending; the classic store route was build-checked but not separately browser-tested in this pass. Existing `.env`, `.data` and credentials were preserved.

Screenshots: `chits-pixel-chat.jpg`, `chits-pixel-orders.jpg`, `chits-pixel-emotes.jpg`, `chits-pixel-reaction-multiplayer.jpg`, `chits-pixel-welcome-desktop.jpg`, and `chits-pixel-welcome-mobile.jpg` in the session visualization directory.

Originally this presentation was tested at `/?layout=structured` and `/store?layout=structured` alongside the old design. That comparison mode has now been removed; `/` and `/store` always use the structured layout.

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
