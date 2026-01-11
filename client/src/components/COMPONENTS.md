# Components

## FringeGlyphLoadingSpinner

An animated loading spinner that cycles through Fringe glyph images with smooth cross-dissolve transitions.

### Description

The spinner loads glyph images from the server (`/api/glyphs`), shuffles them randomly once on mount, and continuously cycles through them with configurable timing. It uses a two-slot alternating system to achieve smooth cross-dissolve transitions between images without visual jumps.

The component is always square and can be positioned anywhere in the viewport.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `x` | `number` | `0` | X position in pixels (from left) |
| `y` | `number` | `0` | Y position in pixels (from top) |
| `size` | `number` | `100` | Width and height in pixels |
| `opacity` | `number` | `1` | Overall component opacity (0-1) |
| `borderRadius` | `number` | `8` | Border radius in pixels (0 for square corners) |
| `fadeInDuration` | `number` | `500` | Component fade-in duration in ms |
| `displayDuration` | `number` | `1500` | How long each image displays in ms |
| `crossDissolveDuration` | `number` | `500` | Cross-dissolve transition time in ms |

### Usage

```tsx
import FringeGlyphLoadingSpinner from './components/FringeGlyphLoadingSpinner';

// Basic usage with defaults
<FringeGlyphLoadingSpinner />

// Customized
<FringeGlyphLoadingSpinner
  x={100}
  y={100}
  size={200}
  opacity={0.8}
  borderRadius={16}
  fadeInDuration={1000}
  displayDuration={2000}
  crossDissolveDuration={800}
/>
```

### Behavior

1. On mount, fetches glyph images from `/api/glyphs`
2. Shuffles the images randomly (order persists for component lifetime)
3. Preloads all images before displaying
4. Fades in the component once images are ready
5. Cycles through images indefinitely with cross-dissolve transitions

### Debug / Test Page

A dedicated debug page is available for testing and adjusting component parameters:

**URL:** `/glyph-spinner-debug.html`

The debug page provides:
- Sliders for all timing parameters (fade-in, display time, cross-dissolve)
- Position and size controls
- Opacity adjustment
- "Reload Component" button to re-shuffle the glyph order

To access during development:
```
http://localhost:5173/glyph-spinner-debug.html
```

### Server Dependency

Requires the `/api/glyphs` endpoint which returns:
```json
{
  "glyphs": [
    "https://cdn.example.com/glyph1.jpg",
    "https://cdn.example.com/glyph2.jpg",
    ...
  ]
}
```

Images are sourced from `avatars/_images/Glyphs/small/` on the server.
