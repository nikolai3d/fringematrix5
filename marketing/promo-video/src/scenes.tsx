import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Backdrop, CrtOverlay } from './Backdrop';
import { C, F, glowText } from './theme';
import { Kicker, Typed, Words } from './ui';
import data from './data.json';
import art from './art.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const GLYPHS = ['Apple', 'Butterfly', 'Flower', 'Frog', 'Hand', 'Horn', 'Leaf', 'Smoke', 'Seahorse'];
const GLYPH_FILTER = 'brightness(0.85) contrast(1.8)';
const glyph = (name: string) => staticFile(`glyphs/${name}Glyph.png`);
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/* ─────────────── 1. Glyph cold open ─────────────── */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const per = 8;
  const idx = Math.min(GLYPHS.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const isLast = idx === GLYPHS.length - 1;
  const opacity = isLast
    ? interpolate(local, [0, 3], [0, 1], clamp)
    : interpolate(local, [0, 2, per - 2, per], [0, 1, 1, 0.1], clamp);
  const scale = isLast ? interpolate(frame, [64, 120], [1, 1.25], clamp) : 1.06 - local * 0.006;
  const flash = interpolate(frame, [64, 67, 80], [0, 0.5, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop gridOpacity={0.06} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Img
          src={glyph(GLYPHS[idx])}
          style={{ width: 560, height: 560, mixBlendMode: 'screen', filter: GLYPH_FILTER, opacity, transform: `scale(${scale})` }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.glow, opacity: flash, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', left: 120, bottom: 110, fontSize: 34 }}>
        <Typed text="> DECRYPTING ARCHIVE :: FRINGE / 2012–2013" start={6} cps={1.1} />
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 2. Origin story + hashtag rain ─────────────── */
const HashtagRain: React.FC = () => {
  const frame = useCurrentFrame();
  const cols = 9;
  const tags = data.campaigns.map((c) => `#${c.hashtag}`);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>
      {Array.from({ length: cols }).map((_, c) => {
        const speed = 2.2 + (c % 3) * 0.9;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: c * 220 - 40,
              top: -900 + ((frame * speed + c * 173) % 900),
              display: 'flex',
              flexDirection: 'column',
              gap: 26,
              fontFamily: F.mono,
              fontSize: 26,
              color: C.cyan,
              opacity: 0.22 + (c % 2) * 0.1,
            }}
          >
            {Array.from({ length: 36 }).map((__, r) => (
              <span key={r}>{tags[(r * 5 + c * 3) % tags.length]}</span>
            ))}
          </div>
        );
      })}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${C.bg}ee 25%, transparent 70%)` }} />
    </AbsoluteFill>
  );
};

const FirstHashtag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  // A few frames of RGB-split glitch as it lands.
  const g = frame > 4 && frame < 16 ? Math.sin(frame * 9) * 10 : 0;
  const text = '#CrossTheLine';
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    fontFamily: F.display,
    fontWeight: 900,
    fontSize: 170,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };
  return (
    <AbsoluteFill style={{ transform: `scale(${1.4 - 0.4 * p})`, opacity: p }}>
      <div style={{ ...base, color: C.pink, transform: `translateX(${g}px)`, mixBlendMode: 'screen', opacity: g ? 0.8 : 0 }}>
        {text}
      </div>
      <div style={{ ...base, color: C.green, transform: `translateX(${-g}px)`, mixBlendMode: 'screen', opacity: g ? 0.6 : 0 }}>
        {text}
      </div>
      <div style={{ ...base, color: C.fg, textShadow: glowText() }}>{text}</div>
      <div
        style={{
          position: 'absolute',
          top: 660,
          width: '100%',
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 32,
          letterSpacing: '0.2em',
          color: C.cyan,
          opacity: interpolate(frame, [18, 30], [0, 1], clamp),
        }}
      >
        JAN 13, 2012 · CAMPAIGN #1 OF {data.campaigns.length}
      </div>
    </AbsoluteFill>
  );
};

export const Origin: React.FC = () => {
  const frame = useCurrentFrame();
  const textOut = interpolate(frame, [62, 74], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 160px', opacity: textOut }}>
        <Words
          text="2012. Fringe was facing cancellation."
          highlight={['Fringe']}
          style={{ fontFamily: F.body, fontWeight: 800, fontSize: 84, color: C.fg }}
        />
        <Words
          text="So the fans fought back, one hashtag at a time."
          delay={22}
          stagger={3}
          style={{ fontFamily: F.body, fontWeight: 300, fontSize: 64, color: C.muted, marginTop: 24 }}
        />
      </AbsoluteFill>
      <Sequence from={66}>
        <HashtagRain />
      </Sequence>
      <Sequence from={74}>
        <FirstHashtag />
      </Sequence>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 3. Art wall ─────────────── */
export const ArtWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = 14;
  const rows = 8;
  const tile = 150;
  const gap = 14;
  const zoom = interpolate(frame, [0, 170], [2.6, 1.02], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const tilt = interpolate(frame, [0, 170], [22, 10], clamp);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 1800, justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
            gap,
            transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(-4deg)`,
          }}
        >
          {Array.from({ length: cols * rows }).map((_, i) => {
            const x = i % cols;
            const y = Math.floor(i / cols);
            const dist = Math.hypot(x - cx, y - cy);
            const p = spring({ frame: frame - dist * 3.2, fps, config: { damping: 18 } });
            return (
              <Img
                key={i}
                src={staticFile(`art/${art[(i * 7) % art.length]}`)}
                style={{
                  width: tile,
                  height: tile,
                  objectFit: 'cover',
                  borderRadius: 8,
                  opacity: p,
                  transform: `rotateY(${(1 - p) * 90}deg) scale(${0.7 + 0.3 * p})`,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                  border: `1px solid rgba(0,212,255,0.25)`,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(0deg, ${C.bg} 5%, ${C.bg}dd 35%, transparent 68%)` }} />
      <div style={{ position: 'absolute', left: 140, bottom: 120, width: 1700 }}>
        <Kicker delay={50}>EVERY FRIDAY · FAN-MADE</Kicker>
        <Words
          text="Artists in the fandom made social media avatars to rally every campaign."
          delay={60}
          highlight={['avatars']}
          style={{ fontFamily: F.body, fontWeight: 800, fontSize: 78, color: C.fg, marginTop: 20 }}
        />
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 4. Stat counters ─────────────── */
const STATS = [
  { value: data.totalImages, label: 'AVATARS', sub: 'archived & searchable' },
  { value: data.campaigns.length, label: 'CAMPAIGNS', sub: 'one per episode night' },
  { value: data.episodes, label: 'EPISODES', sub: 'season 4 → series finale' },
  { value: data.artists, label: 'ARTISTS', sub: 'credited by name' },
];

const StatCard: React.FC<{ stat: (typeof STATS)[number]; delay: number }> = ({ stat, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  const count = interpolate(frame - delay, [4, 50], [0, stat.value], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bar = interpolate(frame - delay, [0, 30], [0, 100], clamp);
  return (
    <div
      style={{
        width: 380,
        height: 360,
        padding: '44px 36px',
        boxSizing: 'border-box',
        background: `linear-gradient(180deg, ${C.bgElev}, rgba(11,17,26,0.6))`,
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: 18,
        position: 'relative',
        overflow: 'hidden',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 80}px)`,
        boxShadow: '0 0 40px rgba(0,212,255,0.08) inset',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, height: 4, width: `${bar}%`, background: C.cyan, boxShadow: `0 0 16px ${C.glow}` }} />
      <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 112, color: C.fg, textShadow: glowText(C.glow, 0.6), lineHeight: 1 }}>
        {fmt(count)}
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, color: C.cyan, letterSpacing: '0.12em', marginTop: 34 }}>
        {stat.label}
      </div>
      <div style={{ fontFamily: F.body, fontWeight: 400, fontSize: 26, color: C.muted, marginTop: 12 }}>{stat.sub}</div>
    </div>
  );
};

export const Stats: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ padding: '150px 140px', flexDirection: 'column' }}>
      <Kicker>THE ARCHIVE, BY THE NUMBERS</Kicker>
      <Words
        text="A whole year of fandom, preserved."
        delay={6}
        highlight={['preserved.']}
        style={{ fontFamily: F.body, fontWeight: 800, fontSize: 80, color: C.fg, marginTop: 20 }}
      />
      <div style={{ display: 'flex', gap: 40, marginTop: 90 }}>
        {STATS.map((s, i) => (
          <StatCard key={s.label} stat={s} delay={24 + i * 12} />
        ))}
      </div>
    </AbsoluteFill>
    <CrtOverlay />
  </AbsoluteFill>
);

/* ─────────────── 5. Timeline bar chart ─────────────── */
const parseDate = (d: string) => new Date(d.replace(/(\d+)(st|nd|rd|th)/, '$1')).getTime();
const T0 = new Date('January 1, 2012').getTime();
const T1 = new Date('February 1, 2013').getTime();
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN'];

export const Timeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x0 = 170;
  const x1 = 1750;
  const base = 800;
  const maxH = 400;
  const xOf = (t: number) => x0 + ((t - T0) / (T1 - T0)) * (x1 - x0);
  const max = Math.max(...data.campaigns.map((c) => c.count));
  const axis = interpolate(frame, [10, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lastS4 = data.campaigns.findIndex((c) => c.episodeId.startsWith('5')) - 1;
  const hiatusA = xOf(parseDate(data.campaigns[lastS4].date)) + 26;
  const hiatusB = xOf(parseDate(data.campaigns[lastS4 + 1].date)) - 26;
  const late = interpolate(frame, [110, 125], [0, 1], clamp);
  const top = data.campaigns.reduce((a, b) => (b.count > a.count ? b : a));
  const topX = xOf(parseDate(top.date));
  return (
    <AbsoluteFill>
      <Backdrop gridOpacity={0.06} />
      <div style={{ position: 'absolute', left: 140, top: 110 }}>
        <Kicker>JAN 2012 → JAN 2013</Kicker>
        <Words
          text="Every campaign. Every Friday night."
          delay={4}
          style={{ fontFamily: F.body, fontWeight: 800, fontSize: 72, color: C.fg, marginTop: 18 }}
        />
      </div>

      {/* summer hiatus band */}
      <div
        style={{
          position: 'absolute',
          left: hiatusA,
          width: hiatusB - hiatusA,
          top: base - 260,
          height: 260,
          border: `2px dashed rgba(137,160,179,0.35)`,
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          opacity: interpolate(frame, [70, 85], [0, 1], clamp),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: F.mono,
          fontSize: 26,
          letterSpacing: '0.2em',
          color: C.muted,
        }}
      >
        SUMMER HIATUS
      </div>

      {/* bars */}
      {data.campaigns.map((c, i) => {
        const p = spring({ frame: frame - 30 - i * 2.2, fps, config: { damping: 15 } });
        const h = (c.count / max) * maxH * p;
        const isTop = c === top;
        return (
          <div
            key={c.hashtag}
            style={{
              position: 'absolute',
              left: xOf(parseDate(c.date)) - 15,
              top: base - h,
              width: 30,
              height: h,
              borderRadius: '6px 6px 0 0',
              background: isTop
                ? `linear-gradient(180deg, ${C.pink}, rgba(255,46,139,0.35))`
                : `linear-gradient(180deg, ${C.cyan}, rgba(0,212,255,0.25))`,
              boxShadow: `0 0 18px ${isTop ? 'rgba(255,46,139,0.6)' : 'rgba(0,212,255,0.4)'}`,
            }}
          />
        );
      })}

      {/* axis */}
      <div style={{ position: 'absolute', left: x0, top: base, width: (x1 - x0) * axis, height: 3, background: C.cyan, boxShadow: `0 0 12px ${C.glow}` }} />
      {MONTHS.map((m, i) => {
        const x = xOf(new Date(2012, i, 1).getTime());
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 40,
              width: 80,
              top: base + 18,
              textAlign: 'center',
              fontFamily: F.mono,
              fontSize: 22,
              color: C.muted,
              opacity: interpolate(frame, [14 + i * 2, 24 + i * 2], [0, 1], clamp),
            }}
          >
            {m}
          </div>
        );
      })}

      {/* season brackets */}
      {[
        { label: 'SEASON 4', a: 0, b: lastS4 },
        { label: 'SEASON 5 · FINAL SEASON', a: lastS4 + 1, b: data.campaigns.length - 1 },
      ].map((s) => {
        const a = xOf(parseDate(data.campaigns[s.a].date)) - 15;
        const b = xOf(parseDate(data.campaigns[s.b].date)) + 15;
        return (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              left: a,
              width: b - a,
              top: base + 64,
              borderTop: `2px solid ${C.cyan}`,
              paddingTop: 12,
              textAlign: 'center',
              fontFamily: F.display,
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: '0.15em',
              color: C.cyan,
              opacity: interpolate(frame, [80, 95], [0, 1], clamp),
            }}
          >
            {s.label}
          </div>
        );
      })}

      {/* callouts */}
      <div
        style={{
          position: 'absolute',
          left: xOf(parseDate(data.campaigns[0].date)) - 15,
          top: base - (Math.max(...data.campaigns.slice(0, 12).map((c) => c.count)) / max) * maxH - 60,
          fontFamily: F.mono,
          fontSize: 24,
          color: C.fg,
          opacity: interpolate(frame, [95, 108], [0, 1], clamp),
        }}
      >
        ▼ #{data.campaigns[0].hashtag}: where it began
      </div>
      <div
        style={{
          position: 'absolute',
          right: 1920 - topX - 15,
          top: base - maxH - 110,
          textAlign: 'right',
          opacity: late,
          transform: `translateY(${(1 - late) * 20}px)`,
        }}
      >
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 56, color: C.pink, textShadow: glowText(C.pink, 0.5) }}>
          {top.count}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: C.fg }}>#{top.hashtag} · the series finale ▼</div>
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 6. Product showcase ─────────────── */
const FEATURES = [
  { t: `Browse all ${data.campaigns.length} campaigns`, s: 'Episode by episode, with air dates & links' },
  { t: 'Every artist credited', s: `${data.artists} artists, linked on every image` },
  { t: 'Download & share', s: 'Grab your favourite avatar in one click' },
  { t: 'Fast & installable', s: 'Responsive images, works offline' },
];

export const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 20 } });
  const rotY = interpolate(frame, [0, 210], [18, 6]);
  const scroll = interpolate(frame, [40, 90], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lightbox = interpolate(frame, [115, 130], [0, 1], clamp);
  const W = 1120;
  const H = 700;
  const shot: React.CSSProperties = { position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover' };
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: 110,
            top: 170,
            width: W,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,212,255,0.35)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.18)',
            transform: `translateX(${(1 - enter) * -300}px) rotateY(${rotY}deg) rotateX(4deg)`,
            opacity: enter,
            background: C.bgElev,
          }}
        >
          <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', background: '#0e1621' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
            ))}
            <div
              style={{
                marginLeft: 20,
                flex: 1,
                height: 32,
                borderRadius: 8,
                background: C.bg,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 16,
                fontFamily: F.mono,
                fontSize: 20,
                color: C.muted,
              }}
            >
              https://fringematrix.art
            </div>
          </div>
          <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden' }}>
            <Img src={staticFile('site-gallery.png')} style={{ ...shot, opacity: 1 - scroll, transform: `translateY(${-scroll * 80}px)` }} />
            <Img src={staticFile('site-gallery2.png')} style={{ ...shot, opacity: scroll, transform: `translateY(${(1 - scroll) * 80}px)` }} />
            <Img src={staticFile('site-lightbox.png')} style={{ ...shot, opacity: lightbox, transform: `scale(${1.04 - 0.04 * lightbox})` }} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 1320, top: 200, width: 520 }}>
        <Kicker delay={10}>THE GALLERY</Kicker>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 36 }}>
          {FEATURES.map((f, i) => {
            const p = spring({ frame: frame - 26 - i * 22, fps, config: { damping: 18 } });
            return (
              <div
                key={f.t}
                style={{
                  display: 'flex',
                  gap: 22,
                  opacity: p,
                  transform: `translateX(${(1 - p) * 60}px)`,
                  padding: '22px 24px',
                  borderRadius: 14,
                  border: '1px solid rgba(0,212,255,0.25)',
                  background: 'rgba(11,17,26,0.75)',
                }}
              >
                <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 28, color: C.cyan, textShadow: glowText(C.glow, 0.4) }}>
                  0{i + 1}
                </div>
                <div>
                  <div style={{ fontFamily: F.body, fontWeight: 800, fontSize: 32, color: C.fg }}>{f.t}</div>
                  <div style={{ fontFamily: F.body, fontSize: 22, color: C.muted, marginTop: 6 }}>{f.s}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 7. End card ─────────────── */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = 'FRINGE MATRIX';
  const restored = spring({ frame: frame - 30, fps, config: { damping: 16 } });
  const url = spring({ frame: frame - 50, fps, config: { damping: 14 } });
  const pulse = 0.7 + 0.3 * Math.sin(frame / 6);
  return (
    <AbsoluteFill>
      <Backdrop gridOpacity={0.08} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `rotate(${frame * 0.25}deg)` }}>
        {GLYPHS.map((g, i) => {
          const a = (i / GLYPHS.length) * Math.PI * 2;
          return (
            <Img
              key={g}
              src={glyph(g)}
              style={{
                position: 'absolute',
                width: 150,
                height: 150,
                mixBlendMode: 'screen',
                filter: GLYPH_FILTER,
                opacity: 0.35 * interpolate(frame, [i * 3, i * 3 + 15], [0, 1], clamp),
                transform: `translate(${Math.cos(a) * 520}px, ${Math.sin(a) * 400}px) rotate(${-frame * 0.25}deg)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: F.display, fontWeight: 900, fontSize: 124, letterSpacing: '0.08em', color: C.fg }}>
          {title.split('').map((ch, i) => {
            const p = spring({ frame: frame - i * 2, fps, config: { damping: 12 } });
            return (
              <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * -30}px)`, textShadow: glowText(C.glow, p), whiteSpace: 'pre' }}>
                {ch}
              </span>
            );
          })}
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: C.cyan,
              marginLeft: -4,
              whiteSpace: 'pre',
              opacity: restored,
              transform: `translateX(${(1 - restored) * -24}px)`,
              textShadow: glowText(C.glow, 0.5 * restored),
            }}
          >
            , RESTORED
          </span>
        </div>
        <Words
          text="The fan art of the Fringe campaigns, preserved."
          delay={26}
          stagger={2}
          style={{ fontFamily: F.body, fontWeight: 300, fontSize: 40, color: C.muted, marginTop: 20, justifyContent: 'center' }}
        />
        <div
          style={{
            marginTop: 60,
            padding: '18px 44px',
            borderRadius: 999,
            border: `2px solid ${C.cyan}`,
            fontFamily: F.mono,
            fontSize: 48,
            color: C.cyan,
            textShadow: glowText(C.glow, 0.5),
            boxShadow: `0 0 ${30 * pulse}px rgba(0,212,255,${0.45 * pulse})`,
            opacity: url,
            transform: `scale(${0.8 + 0.2 * url})`,
          }}
        >
          fringematrix.art
        </div>
      </AbsoluteFill>
      <CrtOverlay />
    </AbsoluteFill>
  );
};
