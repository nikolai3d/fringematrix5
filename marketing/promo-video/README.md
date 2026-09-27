# Fringe Matrix promo video

37-second, 1080p motion-graphics ad for fringematrix.art, built with [Remotion](https://remotion.dev) (React → MP4).

```bash
npm install
node gen-data.mjs        # refresh stats/timeline from ../../data/*.{yaml,json}
./gen-soundtrack.sh      # synthesize the music bed with ffmpeg (required before first render)
npm run studio           # live preview / scrub in the browser
npm run render           # → out/fringe-matrix-promo.mp4
```

- `src/scenes.tsx`: the seven scenes (glyph cold open, origin + hashtag rain, art wall,
  stat counters, timeline chart, product showcase, end card)
- `src/Promo.tsx`: scene order, durations, transitions, audio
- `public/art`: ~80 avatars sampled from `downloads/all`; `public/site-*.png`: screenshots of the live site
