import { loadFont as loadOrbitron } from '@remotion/google-fonts/Orbitron';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/ShareTechMono';

// Palette mirrors client/src/styles.css so the ad looks like the site.
export const C = {
  bg: '#06090f',
  bgElev: '#0b111a',
  fg: '#e6f0ff',
  muted: '#89a0b3',
  cyan: '#00D4FF',
  glow: 'rgb(40, 252, 255)',
  pink: '#FF2E8B',
  green: '#39FF14',
};

export const F = {
  display: loadOrbitron('normal', { weights: ['500', '700', '900'], subsets: ['latin'] }).fontFamily,
  body: loadInter('normal', { weights: ['300', '400', '600', '800'], subsets: ['latin'] }).fontFamily,
  mono: loadMono().fontFamily,
};

export const glowText = (color = C.glow, strength = 1) =>
  `0 0 ${8 * strength}px ${color}, 0 0 ${24 * strength}px ${color}, 0 0 ${60 * strength}px rgba(0,212,255,0.35)`;
