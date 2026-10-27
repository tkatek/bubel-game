# Audio assets

- **Sound effects** — every file in `sfx/` is **original, generated content**
  created for Bubble Pop English: designed and rendered offline by
  `tools/audio/generate.mjs` (additive/subtractive DSP: music-box bells, warm
  marimba, soft sine bloops, filtered noise sweeps, Schroeder reverb), then
  encoded to MP3 (44.1 kHz, 112 kbps) with the pure-JS LAME encoder
  (`@breezystack/lamejs`). No third-party or sampled material.

- **Background music** — `music/bg-theme.mp3` is the **user-supplied track**
  (`happy happy birthday songs`, provided via Downloads on 2026-10-27),
  processed by `tools/audio/process-user-music.mjs` for in-game use: silent
  edges trimmed, loudness matched to a quiet background bed
  (RMS −27 dBFS, peaks ≈ −11 dBFS — about 13 dB below the pop sounds), gentle
  loop fades added, re-encoded to 128 kbps stereo. The level matching is what
  keeps it "not too loud"; the in-game Music slider and mute live on top of
  this. `music/bg-theme.json` is the loop-length sidecar used for gapless
  playback.
  The original instrumental lullaby `music/calm-loop.mp3` ("Bubbles at Rest",
  original generated content, 54.86 s loop) is kept as an alternative — swap
  the `MUSIC_FILE` constant in `js/audio.js` to use it.

## Regenerating

```
cd tools/audio
npm install
node generate.mjs             # rebuilds every SFX + the calm-loop alternative
node process-user-music.mjs   # rebuilds bg-theme.mp3 from src-user-music.mp3
```

Do not hand-edit the MP3s — edit the generators and rebuild so the pack stays
reproducible. If you replace the background track, overwrite
`tools/audio/src-user-music.mp3` and re-run the processor.
