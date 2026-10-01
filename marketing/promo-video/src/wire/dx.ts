import { loadFont as loadMichroma } from '@remotion/google-fonts/Michroma';
import { loadFont as loadRajdhani } from '@remotion/google-fonts/Rajdhani';

// Black-and-gold palette after the Deus Ex: Human Revolution menus. Only the 3D variant uses it; the flat promo
// keeps the site's cyan theme (../theme.ts).
export const D = {
  bg: '#070503',
  fog: '#0c0803',
  fg: '#FFF2D8',
  muted: '#B39461',
  gold: '#FFB320',
  goldHi: '#FFD98A',
  amber: '#E07A0A',
  barFill: 'rgba(38,26,8,0.88)',
  glow: 'rgb(255, 176, 32)',
};

export const DF = {
  // Wide, squared display face (Eurostile-like), for titles and numbers.
  display: loadMichroma().fontFamily,
  // Condensed technical sans, for menu labels, body copy and HUD text.
  ui: loadRajdhani('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily,
};

export const goldGlow = (strength = 1, color = D.glow) =>
  `0 0 ${6 * strength}px ${color}, 0 0 ${22 * strength}px rgba(255,150,20,${0.45 * strength})`;

// Brushed-metal gold fill for display text (the "DEUS EX" logo treatment).
export const metalText: React.CSSProperties = {
  backgroundImage: 'linear-gradient(180deg, #FFF0C2 0%, #FFC94D 38%, #B8730C 52%, #E9A22E 70%, #FFE39A 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};
