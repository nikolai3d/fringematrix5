# Fringe Matrix promo video

37-second, 1080p motion-graphics ad for fringematrix.art, built with [Remotion](https://remotion.dev) (React → MP4).

```bash
npm install
node gen-data.mjs        # refresh stats/timeline from ../../data/*.{yaml,json}
./gen-soundtrack.sh      # synthesize the music bed with ffmpeg (required before first render)
npm run studio           # live preview / scrub in the browser
npm run render           # → out/fringe-matrix-promo.mp4
npm run render:3d        # → out/fringe-matrix-promo-3d.mp4 (3D wireframe / HUD variant)
```

- `src/scenes.tsx`: the seven scenes (glyph cold open, origin + hashtag rain, art wall,
  stat counters, timeline chart, product showcase, end card)
- `src/Promo.tsx`: scene order, durations, transitions, audio
- `src/wire/`: the 3D variant (`FringePromo3D`), same script and timing, rebuilt with
  react-three-fiber: `three.tsx` (WebGL stage, bloom, camera and projection helpers),
  `hud.tsx` (HUD frame, chamfered panels, menu buttons, arcs, glitch text), `scenes.tsx` (the seven 3D scenes),
  `dx.ts` (the Deus Ex: Human Revolution-style black-and-gold palette and fonts)
- `remotion.config.ts`: sets the `angle` GL renderer, which Three.js needs when rendering headless
- `public/art`: ~80 avatars sampled from `downloads/all`; `public/site-*.png`: screenshots of the live site
