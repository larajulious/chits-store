# Jukebox manual testing

Automated coverage (`npm run build && npm test`, in `tests/jukebox.test.mjs`):

- next-track and tie-break rules
- MP3 duration checks, including the shipped track
- one vote per visitor across reconnects
- late joiners getting the same start time
- byte-range audio and blocked paths
- admin skip, disable and validation

The checks below need real devices and real speakers. Before testing voting, add at least three licensed tracks (see `music/README.md`).

## Two or more customers

- [ ] Open the store on two devices, or in two browsers with separate sessions. Both show the same **Now playing** title and progress.
- [ ] Enable music on both devices. The songs line up to within about a second.
- [ ] On device A, vote for a song. Device B's tally and **Up next** update within about half a second.
- [ ] On device A, change the vote. The old song loses the vote, and the totals never count A twice.
- [ ] When the song ends, both devices switch to the winning song together.

## Joining mid-song

- [ ] Wait until a song is about halfway through, then open the store on a third device and enable music. It starts near the current position, not at 0:00.
- [ ] Refresh a listening tab mid-song. After you tap once, it rejoins at the current position. On a refresh, the browser normally asks for a tap before sound can play.

## Autoplay rules

- [ ] **iOS Safari:** music is off on first visit. **Enable music** in the jukebox panel, or the ♪ header button, starts it on one tap.
- [ ] **iOS Safari:** the volume slider is replaced by "Use your device's volume buttons" (iOS ignores page volume). Mute works.
- [ ] **iOS Safari:** lock the phone, or switch apps and come back. Music resumes at the current position, or after a single tap.
- [ ] **Android Chrome:** same steps. The volume slider works.
- [ ] Turn music on, then reload. The ♪ button shows OFF until the first tap anywhere in the store, then plays without opening the jukebox.

## Local controls

- [ ] Mute on device A. Device B keeps playing.
- [ ] Set a lower volume, then reload. The volume and on/off choice are remembered on this device only.
- [ ] Music volume doesn't change the cat's meow or the chat sound, and those effects still play while music is muted.

## Reconnection

- [ ] Turn off Wi-Fi for ~10 seconds, then turn it back on. Already-loaded music keeps playing while offline. After reconnecting, the state and your vote reappear.
- [ ] Open a second tab with the same visitor. The first tab is replaced, as before, and only one tab plays.

## Ties

- [ ] Two visitors vote for different songs (1–1). **Up next** shows whichever of the two has waited longest. That song plays.
- [ ] With no votes, the longest-waiting song plays. Over several songs, every selected track gets a turn.

## Admin

- [ ] Staff dashboard → **Jukebox**: the current song, time left, votes and library are shown.
- [ ] **Skip track**: every visitor moves to the current winner, and votes reset.
- [ ] **Pause voting**: vote buttons are replaced by "Coming up", and songs play in rotation.
- [ ] **Turn off**: music stops for everyone and the panel says the jukebox is off. **Turn on** starts it again.
- [ ] Uncheck a track and press **Save selection**. It leaves the vote list. If it's playing, it finishes first.
- [ ] Add a manifest entry whose file is missing, then press **Rescan library**. It shows as unavailable with a reason and never reaches visitors.
- [ ] While logged out, `POST /api/admin/jukebox` returns 401.

## Performance

- [ ] On a mid-range phone, with music playing: walk around, send chat, open the menu and orders, drag the yarn and pet Miming. Movement stays smooth.
- [ ] While a song plays, no WebSocket messages arrive unless someone votes or the song changes. Check the browser's network panel.
- [ ] With music off, no audio file is downloaded. With music on, only the current song downloads.
- [ ] With reduced motion on, the jukebox shows one lit frame and no floating notes.
