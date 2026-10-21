# Public entry v0.2 — October 21, 2026

Anyone may choose an avatar and enter. Visitor sessions are independent of orders. There are no invitation requirements, personal order ownership, or Served-based visitor ejections. Admin authentication remains required for order changes and room moderation.

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
