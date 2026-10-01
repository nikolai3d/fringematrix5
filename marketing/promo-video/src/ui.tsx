import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F } from './theme';

// Words rise out of a blur one after another.
export const Words: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  highlight?: string[];
  accent?: string;
}> = ({ text, delay = 0, stagger = 4, style, highlight = [], accent = C.cyan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.28em', ...style }}>
      {text.split(' ').map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 200 } });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${(1 - p) * 40}px)`,
              filter: `blur(${(1 - p) * 12}px)`,
              color: highlight.includes(w) ? accent : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Terminal-style typing with a blinking caret.
export const Typed: React.FC<{ text: string; start?: number; cps?: number; style?: React.CSSProperties }> = ({
  text,
  start = 0,
  cps = 1.4,
  style,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - start) * cps));
  const caret = Math.floor(frame / 8) % 2 === 0;
  if (frame < start) return null;
  return (
    <div style={{ fontFamily: F.mono, color: C.cyan, whiteSpace: 'pre', ...style }}>
      {text.slice(0, n)}
      <span style={{ opacity: caret ? 1 : 0 }}>█</span>
    </div>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; delay?: number; style?: React.CSSProperties; accent?: string; glow?: string }> = ({
  children,
  delay = 0,
  style,
  accent = C.cyan,
  glow = C.glow,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const w = interpolate(frame - delay, [0, 20], [0, 56], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontFamily: F.mono,
        fontSize: 24,
        letterSpacing: '0.25em',
        color: accent,
        opacity: o,
        ...style,
      }}
    >
      <span style={{ width: w, height: 2, background: accent, boxShadow: `0 0 10px ${glow}` }} />
      {children}
    </div>
  );
};
