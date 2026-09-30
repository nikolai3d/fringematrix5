import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, F, glowText } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Chamfered sci-fi panel: translucent fill clipped to the shape, outline drawn as SVG so it survives the clip.
export const HudPanel: React.FC<{
  w: number;
  h: number;
  cut?: number;
  color?: string;
  progress?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ w, h, cut = 28, color = C.cyan, progress = 1, style, children }) => {
  const shape = `${cut},0 ${w},0 ${w},${h - cut} ${w - cut},${h} 0,${h} 0,${cut}`;
  const perim = 2 * (w + h);
  return (
    <div style={{ position: 'relative', width: w, height: h, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `polygon(${shape
            .split(' ')
            .map((p) => p.split(',').map((n) => `${n}px`).join(' '))
            .join(', ')})`,
          background: 'linear-gradient(180deg, rgba(0,212,255,0.10), rgba(6,9,15,0.55) 45%, rgba(6,9,15,0.75))',
          opacity: progress,
        }}
      />
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <polygon
          points={shape}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={perim}
          strokeDashoffset={perim * (1 - progress)}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <line x1={w - cut - 70} y1={h - 8} x2={w - cut - 8} y2={h - 8} stroke={color} strokeWidth={4} opacity={progress} />
      </svg>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
    </div>
  );
};

// Text that lands with a burst of RGB split + horizontal slice jitter.
export const GlitchText: React.FC<{ text: string; start?: number; dur?: number; style?: React.CSSProperties }> = ({
  text,
  start = 0,
  dur = 12,
  style,
}) => {
  const frame = useCurrentFrame() - start;
  const on = frame > 0 && frame < dur;
  const g = on ? Math.sin(frame * 9.3) * 12 : 0;
  const slice = on ? Math.abs(Math.sin(frame * 4.1)) * 60 + 20 : 0;
  const layer: React.CSSProperties = { position: 'absolute', inset: 0, whiteSpace: 'pre' };
  return (
    <div style={{ position: 'relative', whiteSpace: 'pre', ...style }}>
      <span style={{ visibility: 'hidden' }}>{text}</span>
      <span style={{ ...layer, color: C.pink, transform: `translateX(${g}px)`, opacity: on ? 0.8 : 0, mixBlendMode: 'screen' }}>{text}</span>
      <span style={{ ...layer, color: C.cyan, transform: `translateX(${-g}px)`, opacity: on ? 0.8 : 0, mixBlendMode: 'screen' }}>{text}</span>
      <span
        style={{
          ...layer,
          clipPath: on ? `inset(${slice}% 0 ${100 - slice - 12}% 0)` : undefined,
          transform: on ? `translateX(${g * 1.6}px)` : undefined,
          opacity: on ? 1 : 0,
        }}
      >
        {text}
      </span>
      <span style={{ ...layer, clipPath: on ? `inset(0 0 ${100 - slice}% 0)` : undefined }}>{text}</span>
      {on && <span style={{ ...layer, clipPath: `inset(${slice + 12}% 0 0 0)` }}>{text}</span>}
    </div>
  );
};

const Corner: React.FC<{ x: 'left' | 'right'; y: 'top' | 'bottom' }> = ({ x, y }) => (
  <div
    style={{
      position: 'absolute',
      [x]: 36,
      [y]: 36,
      width: 46,
      height: 46,
      [`border${y === 'top' ? 'Top' : 'Bottom'}`]: `2px solid ${C.cyan}`,
      [`border${x === 'left' ? 'Left' : 'Right'}`]: `2px solid ${C.cyan}`,
      boxShadow: `0 0 12px rgba(0,212,255,0.25)`,
    }}
  />
);

// Persistent heads-up display over the whole video: viewfinder corners, section label, timecode, telemetry.
export const HudFrame: React.FC<{ sections: { from: number; label: string }[] }> = ({ sections }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const idx = sections.reduce((acc, s, i) => (frame >= s.from ? i : acc), 0);
  const label = sections[idx].label;
  const labelIn = interpolate(frame - sections[idx].from, [0, 10], [0, 1], clamp);
  const s = Math.floor(frame / fps);
  const tc = `00:${String(s).padStart(2, '0')}:${String(frame % fps).padStart(2, '0')}`;
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames - 6], [1, 0], clamp);
  const fadeIn = interpolate(frame, [4, 20], [0, 1], clamp);
  const text: React.CSSProperties = { position: 'absolute', fontFamily: F.mono, fontSize: 20, letterSpacing: '0.18em', color: C.cyan };
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: fadeIn * fadeOut }}>
      <Corner x="left" y="top" />
      <Corner x="right" y="top" />
      <Corner x="left" y="bottom" />
      <Corner x="right" y="bottom" />
      <div style={{ ...text, left: 100, top: 46, opacity: 0.85 }}>
        FRINGE//MATRIX <span style={{ color: C.muted }}>▸</span>{' '}
        <span style={{ opacity: labelIn, color: C.fg, textShadow: glowText(C.glow, 0.3) }}>
          {String(idx + 1).padStart(2, '0')} {label}
        </span>
      </div>
      <div style={{ ...text, right: 100, top: 46, opacity: 0.85 }}>
        <span style={{ color: C.pink, opacity: blink ? 1 : 0.2 }}>●</span> REC {tc}
      </div>
      <div style={{ ...text, left: 100, bottom: 46, fontSize: 16, color: C.muted }}>
        LAT 42.3736 · LON -71.1097 · ARCHIVE 2012–2013
      </div>
      <div style={{ ...text, right: 100, bottom: 46, fontSize: 16, color: C.muted, display: 'flex', gap: 5, alignItems: 'flex-end' }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 6 + Math.abs(Math.sin(frame / 5 + i * 0.9)) * 18,
              background: C.cyan,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
