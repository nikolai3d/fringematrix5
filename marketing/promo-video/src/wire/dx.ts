import { loadFont as loadMichroma } from '@remotion/google-fonts/Michroma';
import { loadFont as loadRajdhani } from '@remotion/google-fonts/Rajdhani';

// Palette: the black backgrounds, haze, shards and menu chrome of the Deus Ex: Human Revolution menus, recolored
// from that game's gold to the icy blue of the Fringe glyphs (sampled from public/glyphs). Only the 3D variant uses
// it; the flat promo keeps the site's theme (../theme.ts).
export const D = {
  bg: '#03060a',
  fog: '#040a10',
  fg: '#EAF7FD',
  muted: '#7FA6BA',
  main: '#6CC8EE',
  hi: '#CFF1FC',
  deep: '#3789AF',
  barFill: 'rgba(8,26,38,0.88)',
  glow: 'rgb(120, 205, 245)',
};

export const DF = {
  // Wide, squared display face (Eurostile-like), for titles and numbers.
  display: loadMichroma().fontFamily,
  // Condensed technical sans, for menu labels, body copy and HUD text.
  ui: loadRajdhani('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily,
};

export const iceGlow = (strength = 1, color = D.glow) =>
  `0 0 ${6 * strength}px ${color}, 0 0 ${22 * strength}px rgba(40,150,210,${0.45 * strength})`;

// Brushed-metal (chrome-blue) fill for display text (the "DEUS EX" logo treatment).
export const metalText: React.CSSProperties = {
  backgroundImage: 'linear-gradient(180deg, #F2FBFF 0%, #9EDCF5 38%, #2A6C92 52%, #6FBCE0 70%, #DDF4FF 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};
