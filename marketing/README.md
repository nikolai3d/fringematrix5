# Marketing

Promotional material for [fringematrix.art](https://fringematrix.art).

## Promo video (`promo-video/`)

A 37-second, 1920×1080 @ 30fps motion-graphics ad, written as React code and rendered to MP4
with [Remotion](https://www.remotion.dev). See [`promo-video/README.md`](promo-video/README.md)
for the commands to preview and render it.

### Research: how "Claude makes motion graphics" videos are made

The motion-infographic videos made with Claude that are circulating online almost all use
**Remotion**. It's an open-source framework that renders React/TypeScript components to video
frame by frame. In January 2026 Remotion released agent skills for Claude Code, and the launch
went viral (about 13M views on X in its first week). The workflow is: describe the video in plain
English, Claude writes the scene components, then Remotion renders them to MP4.

Code-driven alternatives in the same space:

- **HyperFrames**: plain HTML/CSS/GSAP rendered to video in a browser, with no build step. Often
  paired with ElevenLabs for voiceover.
- **Motion Canvas**: animation written in TypeScript.
- **Manim**: a Python library for technical and mathematical animation.

Sources:

- [Claude Code + Remotion motion-graphics guide (claude-code-handbook)](https://github.com/ThamJiaHe/claude-code-handbook/blob/main/docs/motion-graphics-claude-remotion-guide.md)
- [How I make custom motion graphics using Claude Code + Remotion](https://louisedesadeleer.substack.com/p/how-i-make-custom-motion-graphics)
- [claude-remotion-skill (FrancesUgwu)](https://github.com/FrancesUgwu/claude-remotion-skill)
- [claude-remotion-skill (haidrrrry)](https://github.com/haidrrrry/claude-remotion-skill)
- [Claude for Video Editing in 2026: What Works, What Breaks, and the Real Pipeline (Selects)](https://cutback.video/blog/claude-for-video-editing-in-2026-what-works-what-breaks-and-the-real-pipeline)
- [Everything Claude Code + Remotion Can Do in 2026 (YouTube)](https://www.youtube.com/watch?v=OX80FZjHJ7o)
- [How I Created a Professional Motion Graphics Video With Claude Code + Remotion Skills (YouTube)](https://www.youtube.com/watch?v=xAUifztpib8)
- [Claude Code + Remotion = FREE Motion Graphics Tutorial (YouTube)](https://www.youtube.com/watch?v=kXmY6yQa5q4)
- [What Is HyperFrames? The HTML-Based Video Renderer for AI Agents (MindStudio)](https://www.mindstudio.ai/blog/what-is-hyperframes-html-video-renderer-ai-agents)
- [How to Use Claude Code for Video Editing: Motion Graphics Without Coding (MindStudio)](https://www.mindstudio.ai/blog/claude-code-video-editing-motion-graphics)
- [How to Build an AI Video Editing Workflow with Claude Code and Hyperframes (MindStudio)](https://www.mindstudio.ai/blog/ai-video-editing-claude-code-hyperframes)
- [How to Generate AI Videos with Claude Code, HyperFrames, and ElevenLabs (MindStudio)](https://www.mindstudio.ai/blog/ai-video-generation-claude-code-hyperframes-elevenlabs)
- [How to Create Motion Graphics & Animation With Claude Code (Creative Haven)](https://www.thecreativehaven.com/insights/how-to-create-motion-graphics-amp-animation-with-claude-code-full-workflow)
- [Can Claude Make Videos? Yes, in 3 Ways (Pexo)](https://pexo.ai/blog/can-claude-code-make-videos-5767)
- [Remotion Alternatives for AI Video (Pexo)](https://pexo.ai/blog/remotion-alternatives-4966)
- [5 INSANE Claude Code + Video Prompts (sabrina.dev)](https://www.sabrina.dev/p/5-insane-claude-code-video-prompts)
- [Claude Code Video with Remotion: Best Motion Guide 2026 (dplooy)](https://www.dplooy.com/blog/claude-code-video-with-remotion-best-motion-guide-2026)

### Toolchain

| Tool | Role |
|---|---|
| Node 22+ / npm | Runtime |
| [`remotion`, `@remotion/cli`](https://www.remotion.dev/docs/) | Renders React scenes to MP4 |
| [`@remotion/transitions`](https://www.remotion.dev/docs/transitions/) | Fades, slides and wipes between scenes |
| [`@remotion/google-fonts`](https://www.remotion.dev/docs/google-fonts/) | Orbitron and Inter (the site's fonts), plus Share Tech Mono |
| Headless Chrome | Frame renderer; Remotion downloads it automatically |
| [ffmpeg](https://ffmpeg.org) | Encoding, and synthesizing the music bed (`gen-soundtrack.sh`) |
| [Playwright](https://playwright.dev) | Screenshots of the live site (already a repo dev dependency) |
| `sips` (macOS) | Resizing the sampled avatars, converting the glyphs from WebP to PNG |

Optional, not used here: Remotion's Claude agent skill (`npx skills add remotion-dev/skills`), and
[ElevenLabs](https://elevenlabs.io) for a voiceover.

### What was built

The video has seven scenes, joined by transitions (`promo-video/src/scenes.tsx`, `promo-video/src/Promo.tsx`):

1. **Glyph cold open**: the Fringe glyphs flash in sequence while a terminal line types
   "DECRYPTING ARCHIVE :: FRINGE / 2012–2013".
2. **Origin**: "2012. Fringe was facing cancellation. So the fans fought back, one hashtag at a
   time.", followed by a rain of the campaign hashtags and a glitchy **#CrossTheLine**.
3. **Art wall**: a 14×8 grid of real campaign avatars flips in while the camera pulls back.
4. **Stats**: animated counters for avatars, campaigns, episodes and credited artists.
5. **Timeline chart**: one bar per campaign, placed by air date (Jan 2012 → Jan 2013) and sized by
   avatar count. It shows the Season 4 and Season 5 brackets and the summer hiatus, and highlights
   #KeepLookingUp (the series finale, the largest campaign).
6. **Product showcase**: screenshots of the site's gallery and lightbox in a tilted browser
   frame, with one callout: "Browse all 27 campaigns, from January 2012 to January 2013, episode by episode."
7. **End card**: a glowing "FRINGE MATRIX, RESTORED" title inside a rotating ring of glyphs, and a
   **fringematrix.art** button.

Design notes:

- The colors come from `client/src/styles.css` (`#06090f` background, `#00D4FF` cyan,
  `#FF2E8B` pink) and the fonts match the site, so the ad looks like the product.
- The numbers come from the site's data. `gen-data.mjs` reads `data/campaigns.yaml`,
  `data/authors.yaml` and `data/images.json` and writes `src/data.json`. At the time of rendering:
  1,741 avatars, 27 campaigns, 28 episodes, 18 artists.
- `public/art/` holds about 80 avatars sampled from the local `downloads/all` archive (3 per
  campaign, resized to 400px). `public/glyphs/` holds the nine Fringe glyphs.
- `public/site-*.png` are Playwright screenshots of the live deployment.
- The soundtrack is a placeholder: a synthwave-style bed synthesized entirely with ffmpeg
  (`aevalsrc`), so no licensed audio is involved. The `.wav` is generated, not committed; run
  `./gen-soundtrack.sh` before rendering.

### Known issues / follow-ups

- The screenshots were taken from `https://fringematrix5.vercel.app` because fringematrix.art
  still pointed at an old host at the time. As of 2026-09-27 fringematrix.art serves the same
  Vercel deployment with a valid certificate, so the address shown in the video works and the
  screenshots don't need to be retaken.
- Swap the synthesized music bed for real licensed music before any public use.
- Possible extras: a 9:16 vertical cut for Reels/Shorts/TikTok, and a voiceover.
