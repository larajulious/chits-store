# Resident cat and menu-guide performance

Miming is a shared, server-authoritative shop cat. Visitors can tap or drag the floor yarn, use **Toss yarn**, or pet Miming while nearby. The cat alternates between strolling, sitting, resting, stretching, and sleeping; a moved ball may catch its attention after a variable delay. It approaches, bats the yarn, and eventually settles again. The cat and yarn are transient in-memory room state; they do not write to SQLite. A single PM2 fork is required for all visitors to see the same state.

The menu guide is a local Phaser character. Its route, pause and sprite animation run in the scene's existing animation loop and send no WebSocket positions. Pointer-down on its expanded hit area opens the local menu shell immediately, highlights the guide and pauses its walk. The Menu action below the scene remains the keyboard-accessible equivalent. The public menu fetch runs only when its 30-second client cache is stale, when staff change it, or when visitors choose Refresh.

## Architecture and audit findings

- Phaser owns sprite rendering and all browser-frame interpolation. The cat receives a bounded shared snapshot at most about every 300 ms while moving, plus immediate interaction events; it does not send per-frame coordinates. Local yarn drag messages are throttled to about 12 per second per visitor and subject to the existing socket flood limit. Tosses have a 1.8-second cooldown; petting has a 2.5-second per-socket cooldown plus a 2.1-second cat-wide response period. One visitor holds the yarn at a time for up to five seconds; disconnect and replacement release it.
- The room owns one mascot simulation timer, which wakes at 100 ms while occupied and checks only every two seconds while empty. A local benchmark caught a real first-visitor delay: the initial idle sleep could keep the cat still for up to two seconds. Joining the first visitor now wakes the timer immediately. The room's one-second expiry sweep remains authoritative. Broadcasts now reuse its recent expiry check instead of repeating SQLite visitor reads for each mascot or movement event. Revocation and close-store paths still disconnect explicitly.
- WebSocket mascot updates go directly to the Phaser component and do not enter Vue's reactive store-page state. Remote visitor movement also goes straight to Phaser; the presence list changes reactively only on joins and leaves. Previously, each `player_moved` packet rebuilt the Vue players array and triggered a deep watcher over the whole scene. The guide and cat share Phaser's scene update; there is no separate browser animation loop or character socket. When a tab is hidden, the game loop sleeps and wakes on visibility change; the listener and Phaser game are removed on unmount. Reduced motion keeps essential location changes but removes decorative bob and rotation.
- The guide was already handled on pointer-down without server acknowledgment. In this codebase, no measured menu-open delay was reproduced. Its old route crossed the yarn's default tile while the yarn hit test ran first, so a tap on the guide could grab the ball. The revised route avoids that tile, and the guide's hit test has priority when they do overlap. The larger stable hit area, local selected tint and paused route avoid a moving target during interaction. Menu data fetching starts after the shell state changes, with a visible loading state.
- The current 40-visitor room limit remains. The PM2 example uses one fork process. SQLite stores visitors/orders/menu/feedback, but no cat or guide coordinates or animation frames.

## Local measurements, October 21, 2026

`npm run typecheck`, `npm run build`, `npm test` (40 passing tests), `git diff --check`, `node scripts/benchmark-room.mjs`, and an isolated production-server Chromium run passed. The same benchmark script also ran against a detached build of committed baseline `6362c1b`; no production data was used. It uses disposable SQLite, separate signed visitor sessions and loopback WebSockets. It moves the yarn once per sample, counts all received mascot messages across clients for 1.2 seconds, and reads process RSS with `ps`. These are macOS/Node 24.15.0 results, **not** VPS capacity figures:

To repeat the comparison, build the baseline in a separate checkout, then run the current driver with `CHITS_BENCH_APP_ROOT=/absolute/path/to/baseline node scripts/benchmark-room.mjs`; omit the variable for the optimized build. Each run creates and deletes its own temporary database.

| Requested sockets | Accepted | Room-full | Baseline mascot messages/s | Optimized mascot messages/s | Baseline RSS | Optimized RSS |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 | 0 | 64 MiB | 66 MiB |
| 1 | 1 | 0 | 6.7 | 2.5 | 66 MiB | 67 MiB |
| 10 | 10 | 0 | 66.7 | 33.3 | 69 MiB | 69 MiB |
| 25 | 25 | 0 | 145.6 | 83.3 | 73 MiB | 66 MiB |
| 50 | 40 | 10 | 233.1 | 99.9 | 79 MiB | 73 MiB |
| 100 | 40 | 60 | 266.2 | 133.2 | 80 MiB | 75 MiB |

The 40-client samples show 266.2 to 133.2 mascot message deliveries per second for the 100-request case, roughly half, while maintaining the same 40-person cap. These 1.2-second samples are sensitive to random cat motion and timer phase; they do not establish sustained throughput. RSS is a point-in-time reading and can fall after garbage collection, as it did in this run. An earlier local run before the first-visitor wake fix delivered zero mascot updates in the first 1.2 seconds with one client; after the fix, comparable runs delivered 2.5–3.3/s. There is no direct measurement yet of VPS CPU, Node event-loop delay, browser long tasks, or real mobile-device memory.

In headless Chromium at 390×844, with a second desktop visitor at 1440×900, the first moving-guide tap opened the menu dialog in 7–8 ms across local runs. Eight repeated taps opened it in 1–4 ms each and made one `/api/menu/today` request total. The scripted fixed-coordinate tap missed the moving guide in two baseline runs; screenshots showed the guide had walked away from its starting position, so those misses are not valid menu-latency measurements. A 1.21-second `requestAnimationFrame` sample observed 73 frames, about 60 FPS, on the local headless browser. The two-visitor integration test verified shared snapshots, yarn lock ownership, invalid floor coordinates, disconnect release, petting proximity/cooldown, and toss motion. The optimized browser had no page errors. The mobile screenshot is saved as a local session artifact at `/Users/larajulious/.codex/visualizations/2026/10/21/01a15be7-9c18-71d0-944a-48e56d6363c4/chits-resident-cat-mobile.png`.

## Manual acceptance on devices and VPS

1. Build and start the single PM2 fork on the VPS with the existing `.env` and persistent `.data`. Open the store on two different devices. Both should see the same cat and ball, while the menu guide may walk in different local phases.
2. Drag and throw the ball on touch and mouse. The other visitor should see it move; only one visitor should control it at once. Toss repeatedly and confirm cooldown, then close the dragging visitor's tab and confirm the other can pick it up immediately.
3. Walk near Miming and pet it. Confirm the purring cue appears to both visitors, and distant pet attempts show the proximity hint. Wait for resting, sleeping, walking, noticing, approaching, and play states. Random choices mean this may take several minutes.
4. Tap the moving menu guide near the edge of its sprite several times, then use the keyboard-accessible Menu action. The dialog should appear immediately. Close it and confirm the guide resumes. Change today's menu in admin and verify an open visitor dialog refreshes.
5. Repeat with a hidden/background tab, reduced motion, and a narrow mobile viewport. Check that the game resumes, controls still work, and no touch drag scrolls the page.
6. During a quiet traffic window, repeat `node scripts/benchmark-room.mjs` on a staging VPS with its own disposable database. Monitor PM2 CPU/RSS and event-loop delay separately. Do not infer 50- or 100-active-visitor capacity from the current script: the 40-person cap rejects the excess.

Production HTTPS/WSS, physical touch devices, VPS CPU and long-session memory behavior remain unverified locally. The Phaser client chunk is still about 1.2 MB uncompressed; no asset optimization was attempted without a measured load bottleneck.
