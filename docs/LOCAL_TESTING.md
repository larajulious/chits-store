# Local smoke test — October 21, 2026

> Historical v0.1 invitation-only test. For the current public visitor model, see [public-entry validation](PUBLIC_ENTRY_TESTING.md).

This records the initial smoke test. The later [foundation audit](FOUNDATION_AUDIT.md) adds automated authentication/security coverage, Served/expiry checks, and another browser pass; its results supersede the pending checks below where explicitly covered.

## Environment

- Node.js 24.15.0, Nuxt 4.5.2, Nitro 2.13.5, Phaser 3.90.0.
- `npm run build` passed before and after the rendering fix. Vite reports a large Phaser bundle warning.
- Tested the built Node server on loopback port 3100 with a temporary SQLite database and test credentials. Existing `.env`, application data, and the development server on port 3000 were left intact.
- Used two tabs in the Codex in-app browser with separate host-scoped sessions: `localhost` and `127.0.0.1`. Each tab used its own hostname consistently for the invitation, API, and WebSocket connection. This checks independent customer sessions, but does not constitute testing two browser apps or devices.
- The test server used development cookie settings over local HTTP. Production secure cookies and HTTPS/WSS were not covered.

## Results

| Scenario | Observed result |
| --- | --- |
| Sign in through the staff dashboard | Passed using isolated test credentials. |
| Create two orders through the dashboard | `SMOKE-1001` and `SMOKE-1002` received distinct private invitations. |
| Open invitations and choose profiles | `MochiTest` and `BobaTest` entered with different avatars and order numbers. |
| Shared presence | Both sessions displayed `2 online`. |
| Avatar visibility and movement | Both avatars were visible after moving apart from their shared entrance spawn; movement appeared in the other session. |
| Bidirectional chat | Both customers saw both messages without reloading. |
| Mark first order Ready through dashboard | First customer received the Ready notice and updated My Order panel; second customer's order remained Preparing. |
| Live board | Second customer saw the first order under Ready and its own order under Preparing. |
| Reopen invitations after test-server restart | Existing profiles and saved order status were retained; both customers rejoined. |
| Repeat chat and Ready on corrected build | Bidirectional chat and the second customer's Ready notice passed. |
| Browser warnings/errors on final customer pages | None captured. |

## Fix found during testing

`game/createGame.ts` destroyed the scene's background Graphics object immediately after drawing it. In Phaser this removes the displayed artwork, so only text and sprites remained visible. The Graphics object now stays in the scene and is cleaned up with the scene. The rebuilt app was visually checked for its floor, kitchen, counter, board, tables, and both avatars.

Both players currently spawn at the same entrance coordinates and overlap until one moves. This remains prototype behavior.

## Remaining acceptance checks

- Two browser apps and physical phones, including virtual joystick/touch input and reconnect after backgrounding or a network interruption.
- HTTPS/WSS and production cookie behavior behind Nginx.
- Served's final transition and five-minute access expiry.
- Moderation, security/abuse testing, backups, and multiplayer load testing before public chat access.

To repeat manually, run `npm run dev`, create two distinct orders in `/admin`, and open each invitation in a different browser app/profile. Keep each browser's hostname consistent. Choose different nicknames, move away from the shared entrance, exchange messages in both directions, and mark one order Ready. Verify only its owner receives the personal Ready notification while both boards update.
