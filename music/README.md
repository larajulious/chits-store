# Jukebox music

The store jukebox plays tracks listed in `tracks.json` from this folder. Files are served at
`/jukebox/audio/<file>` with byte-range support, so browsers can start mid-song and iOS Safari can play them.
Set `JUKEBOX_DIR` to use a different folder.

## Adding a track

1. Use only original music or music you are licensed to play publicly. Don't add commercial recordings
   without permission.
2. Encode it as MP3. For phones and slow connections, use 96 kbps stereo or 64 kbps mono at 44.1 kHz.
   A 3-minute track at 96 kbps is about 2 MB.
3. Copy the file here and add an entry to `tracks.json`:

   ```json
   {
     "id": "rainy-cafe",
     "title": "Rainy Cafe",
     "mood": "Soft rain piano",
     "artist": "Composer name",
     "file": "rainy-cafe.mp3",
     "durationSec": 184.2,
     "license": "Where it came from and the license terms"
   }
   ```

   - `id`: a stable ID made of lowercase letters, numbers and dashes. Votes and admin selections refer to it, so don't change it later.
   - `durationSec`: the track's length. The server measures the file and rejects the entry if the two differ by more than 1.5 seconds.
     On macOS, `afinfo file.mp3` shows the length as "estimated duration".
4. In the staff dashboard, open **Jukebox** and press **Rescan library**. If you'd rather not rescan, restart the app.
   Each track is either selectable or shows why it can't play (missing file, wrong duration, unreadable MP3).

Tracks with problems are never offered to visitors. The jukebox works with any number of valid tracks. Voting
shows up to five songs, so 3–5 tracks works best.

Suggested moods for the store: Cozy Afternoon, Rainy Cafe, Happy Meryenda, Quiet Evening, Pixel Chill.
