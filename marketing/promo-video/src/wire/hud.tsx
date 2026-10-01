import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import data from '../data.json';
import { D, DF, goldGlow } from './dx';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const toClip = (shape: string) =>
  `polygon(${shape
    .split(' ')
    .map((p) => p.split(',').map((n) => `${n}px`).join(' '))
    .join(', ')})`;

// Chamfered panel in the Deus Ex style: dark amber glass, gold outline (drawn in as `progress` rises) with an inset
// hairline, and a short gold tab on the bottom edge.
export const HudPanel: React.FC<{
  w: number;
  h: number;
  cut?: number;
  color?: string;
  progress?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ w, h, cut = 28, color = D.gold, progress = 1, style, children }) => {
  const shape = `${cut},0 ${w},0 ${w},${h - cut} ${w - cut},${h} 0,${h} 0,${cut}`;
  const i = 7;
  const inner = `${cut + i * 0.4},${i} ${w - i},${i} ${w - i},${h - cut - i * 0.4} ${w - cut - i * 0.4},${h - i} ${i},${h - i} ${i},${cut + i * 0.4}`;
  const perim = 2 * (w + h);
  return (
    <div style={{ position: 'relative', width: w, height: h, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: toClip(shape),
          background: 'linear-gradient(160deg, rgba(255,179,32,0.16), rgba(20,13,4,0.72) 40%, rgba(10,7,2,0.86))',
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
        <polygon points={inner} fill="none" stroke={color} strokeWidth={1} opacity={0.35 * progress} />
        <line x1={w - cut - 90} y1={h - 3} x2={w - cut - 8} y2={h - 3} stroke={D.goldHi} strokeWidth={5} opacity={progress} />
      </svg>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
    </div>
  );
};

// A main-menu button: slanted left end, chamfered right corner, label right-aligned. `active` is the highlighted
// option (gold outline and amber fill); 0..1 so the highlight can glide between options.
export const MenuBar: React.FC<{ w: number; h?: number; label: string; active?: number; progress?: number; fontSize?: number }> = ({
  w,
  h = 58,
  label,
  active = 0,
  progress = 1,
  fontSize = 30,
}) => {
  const s = h * 0.55;
  const c = 12;
  const shape = `${s},0 ${w - c},0 ${w},${c} ${w},${h} ${s * 0.15},${h} 0,${h - s * 0.2} 0,${h * 0.45}`;
  return (
    <div style={{ position: 'relative', width: w, height: h, opacity: progress, transform: `translateX(${(1 - progress) * -40}px)` }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: toClip(shape),
          background: `linear-gradient(180deg, rgba(58,40,12,0.92), rgba(24,16,5,0.94))`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: toClip(shape),
          background: 'linear-gradient(90deg, rgba(255,170,30,0.05), rgba(255,170,30,0.55) 70%, rgba(255,214,120,0.75))',
          opacity: active,
        }}
      />
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <polygon points={shape} fill="none" stroke={D.gold} strokeWidth={2} opacity={0.25 + 0.75 * active} style={{ filter: active > 0.5 ? `drop-shadow(0 0 8px ${D.gold})` : undefined }} />
        <polygon
          transform={`translate(${-5 * active} ${-5 * active})`}
          points={shape}
          fill="none"
          stroke={D.goldHi}
          strokeWidth={1.5}
          opacity={0.7 * active}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          right: 26,
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          fontFamily: DF.ui,
          fontWeight: 600,
          fontSize,
          letterSpacing: '0.04em',
          color: active > 0.5 ? '#FFF8E6' : '#F3E6CC',
          textShadow: active > 0.5 ? goldGlow(0.6) : '0 1px 2px #000',
        }}
      >
        {label}
      </div>
    </div>
  );
};

// Text that lands with a burst of split color + horizontal slice jitter.
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
      <span style={{ ...layer, color: D.amber, transform: `translateX(${g}px)`, opacity: on ? 0.85 : 0, mixBlendMode: 'screen' }}>{text}</span>
      <span style={{ ...layer, color: D.goldHi, transform: `translateX(${-g}px)`, opacity: on ? 0.8 : 0, mixBlendMode: 'screen' }}>{text}</span>
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

// Huge thin concentric arcs sweeping across the frame, as behind the Director's Cut title cards.
export const Arcs: React.FC<{ cx?: number; cy?: number; r0?: number; n?: number; opacity?: number; speed?: number }> = ({
  cx = -300,
  cy = 1500,
  r0 = 900,
  n = 7,
  opacity = 0.5,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity }}>
      <defs>
        <linearGradient id="arcfade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={D.gold} stopOpacity="0" />
          <stop offset="0.45" stopColor={D.goldHi} stopOpacity="1" />
          <stop offset="1" stopColor={D.gold} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {Array.from({ length: n }).map((_, i) => {
        const r = r0 + i * 150 + i * i * 12;
        const len = 2 * Math.PI * r;
        const sweep = interpolate(frame, [i * 3, i * 3 + 40], [0, 0.32], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="url(#arcfade)"
            strokeWidth={i % 3 === 0 ? 2.2 : 1.2}
            strokeDasharray={`${len * sweep} ${len}`}
            transform={`rotate(${-95 + i * 4 + frame * 0.05 * speed * (i % 2 ? 1 : -0.6)} ${cx} ${cy})`}
            opacity={0.35 + (i % 3 === 0 ? 0.4 : 0)}
          />
        );
      })}
    </svg>
  );
};

// Spinning circular emblem (the bottom-right "loading" badge of the HR menus).
const Reticle: React.FC<{ size?: number }> = ({ size = 70 }) => {
  const frame = useCurrentFrame();
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} style={{ overflow: 'visible', filter: `drop-shadow(0 0 6px ${D.gold})` }}>
      <circle r={r - 2} fill="none" stroke={D.gold} strokeWidth={3} strokeDasharray={`${r * 1.6} ${r * 0.5}`} transform={`rotate(${frame * 3})`} />
      <circle r={r * 0.62} fill="none" stroke={D.goldHi} strokeWidth={1.5} strokeDasharray={`${r * 0.5} ${r * 0.3}`} transform={`rotate(${-frame * 5})`} />
      <circle r={r * 0.22} fill={D.goldHi} />
    </svg>
  );
};

const TICKER = `FRINGEMATRIX.ART  //  THE FAN ART OF THE FRINGE CAMPAIGNS, PRESERVED  //  ${data.totalImages.toLocaleString('en-US')} AVATARS  //  ${data.campaigns.length} CAMPAIGNS  //  ${data.artists} ARTISTS  //  `;

const Bracket: React.FC<{ x: 'left' | 'right' }> = ({ x }) => (
  <div
    style={{
      position: 'absolute',
      [x]: 40,
      top: 40,
      width: 30,
      height: 64,
      borderTop: `2px solid ${D.gold}`,
      [`border${x === 'left' ? 'Left' : 'Right'}`]: `2px solid ${D.gold}`,
      opacity: 0.7,
    }}
  />
);

// Persistent heads-up display: logo lockup and section, build/timecode, a dark ticker band across the bottom, and
// the spinning emblem.
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
  const text: React.CSSProperties = { position: 'absolute', fontFamily: DF.ui, fontWeight: 600, fontSize: 22, letterSpacing: '0.14em', color: D.gold };
  // Two identical halves, so sliding by -50% of the strip lands exactly on the start again.
  const tickerT = ((frame * 2.2) / (TICKER.length * 2 * 12)) % 1;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: fadeIn * fadeOut }}>
      <Bracket x="left" />
      <Bracket x="right" />
      <div style={{ ...text, left: 88, top: 44, display: 'flex', alignItems: 'baseline', gap: 18 }}>
        <span style={{ fontFamily: DF.display, fontSize: 22, letterSpacing: '0.08em', color: D.goldHi, textShadow: goldGlow(0.4) }}>FRINGE MATRIX</span>
        <span style={{ color: D.muted }}>▸</span>
        <span style={{ opacity: labelIn, color: D.fg }}>
          {String(idx + 1).padStart(2, '0')} {label}
        </span>
      </div>
      <div style={{ ...text, right: 88, top: 44, fontWeight: 500, color: D.muted }}>
        ARCHIVE <span style={{ color: D.gold }}>{tc}</span>
      </div>
      {/* ticker band */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 52,
          height: 40,
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 12%, rgba(0,0,0,0.72) 88%, rgba(0,0,0,0) 100%)',
          overflow: 'hidden',
          maskImage: 'linear-gradient(90deg, transparent 6%, black 16%, black 80%, transparent 90%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 7,
            left: 0,
            transform: `translateX(${-tickerT * 50}%)`,
            whiteSpace: 'pre',
            fontFamily: DF.ui,
            fontWeight: 500,
            fontSize: 24,
            letterSpacing: '0.06em',
            color: '#E9DCC2',
          }}
        >
          {TICKER.repeat(4)}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 96, bottom: 104 }}>
        <Reticle />
      </div>
      <div style={{ ...text, right: 64, bottom: 18, fontSize: 18, fontWeight: 500, letterSpacing: '0.06em', color: D.muted }}>
        Build 2012.0113.{String(frame).padStart(4, '0')}
      </div>
    </AbsoluteFill>
  );
};
