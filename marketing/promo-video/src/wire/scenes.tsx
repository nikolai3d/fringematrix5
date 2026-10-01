import { useMemo } from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { CrtOverlay } from '../Backdrop';
import { Kicker as BaseKicker, Typed, Words as BaseWords } from '../ui';
import data from '../data.json';
import art from '../art.json';
import { D, DF, iceGlow, metalText } from './dx';
import { Arcs, GlitchText, HudPanel, MenuBar } from './hud';
import { Cam, Edges, FloorGrid, Particles, Shards, Stage, TriNet, hot, makeGlyphGrade, mulberry, project, px, pxSize, useGlyphGrade, type V3 } from './three';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const GLYPHS = ['Apple', 'Butterfly', 'Flower', 'Frog', 'Hand', 'Horn', 'Leaf', 'Smoke', 'Seahorse'];
const GLYPH_URLS = GLYPHS.map((g) => staticFile(`glyphs/${g}Glyph.png`));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const Kicker: React.FC<React.ComponentProps<typeof BaseKicker>> = (p) => (
  <BaseKicker accent={D.main} glow={D.glow} {...p} style={{ fontFamily: DF.ui, fontWeight: 600, fontSize: 26, letterSpacing: '0.22em', ...p.style }} />
);
const Words: React.FC<React.ComponentProps<typeof BaseWords>> = (p) => <BaseWords accent={D.main} {...p} />;

const useTextures = (urls: string[]) => {
  const tex = useLoader(THREE.TextureLoader, urls);
  useMemo(() => tex.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace)), [tex]);
  return tex;
};

// Ring of radial tick marks, like a targeting reticle.
const TickRing: React.FC<{ r: number; n?: number; len?: number; color?: string; opacity?: number }> = ({
  r,
  n = 120,
  len = 0.18,
  color = D.main,
  opacity = 0.8,
}) => {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = i % 10 === 0 ? len * 2.2 : len;
      pts.push(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * (r + l), Math.sin(a) * (r + l), 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [r, n, len]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={hot(color, 1.3)} toneMapped={false} transparent opacity={opacity} />
    </lineSegments>
  );
};

const Circle: React.FC<{ r: number; color?: string; opacity?: number; k?: number }> = ({ r, color = D.main, opacity = 1, k = 1.5 }) => {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= 128; i++) pts.push(Math.cos((i / 128) * Math.PI * 2) * r, Math.sin((i / 128) * Math.PI * 2) * r, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [r]);
  return (
    // @ts-expect-error: r3f's <line> collides with the SVG <line> JSX type
    <line geometry={geo}>
      <lineBasicMaterial color={hot(color, k)} toneMapped={false} transparent opacity={opacity} />
    </line>
  );
};

/* ─────────────── 1. Glyph cold open: a glyph core inside a spinning wireframe lattice ─────────────── */
const IntroWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const tex = useTextures(GLYPH_URLS);
  const per = 8;
  const idx = Math.min(GLYPHS.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const isLast = idx === GLYPHS.length - 1;
  const glyphO = isLast ? interpolate(local, [0, 3], [0, 1], clamp) : interpolate(local, [0, 2, per - 2, per], [0, 1, 1, 0.1], clamp);
  const burst = interpolate(frame, [64, 100], [1, 1.9], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ico = useMemo(() => new THREE.IcosahedronGeometry(2.6, 1), []);
  const outer = useMemo(() => new THREE.IcosahedronGeometry(4.2, 0), []);
  const camZ = interpolate(frame, [0, 110], [16, 11], { easing: Easing.inOut(Easing.cubic) });
  return (
    <>
      <Cam pos={[Math.sin(frame / 50) * 1.5, 0.6, camZ]} />
      <Particles count={500} spread={[50, 30, 40]} seed={3} rotY={frame * 0.002} />
      <group rotation={[frame * 0.011, frame * 0.017, 0]} scale={burst}>
        <Edges geometry={ico} k={1.4} opacity={0.9} />
      </group>
      <Shards frame={frame} count={70} seed={4} spread={[28, 16, 8]} center={[0, 0, -6]} size={0.42} burst={0.75 + burst * 0.25} spin={1.4} opacity={interpolate(frame, [0, 20], [0, 1], clamp)} />
      <group rotation={[-frame * 0.006, -frame * 0.009, frame * 0.004]} scale={1 + (burst - 1) * 1.6}>
        <Edges geometry={outer} color={D.deep} k={1.2} opacity={interpolate(frame, [0, 30], [0, 0.55], clamp)} />
      </group>
      <group rotation={[0, 0, -frame * 0.01]}>
        <TickRing r={3.4 * burst} opacity={interpolate(frame, [10, 30], [0, 0.7], clamp)} />
      </group>
      <group rotation={[0, 0, frame * 0.02]}>
        <Circle r={3.1 * burst} opacity={0.4} />
      </group>
      {/* glyphs keep their own colors: normal blending, neutral (white) tint */}
      <mesh scale={isLast ? interpolate(frame, [64, 120], [1, 1.3], clamp) : 1.06 - local * 0.006}>
        <planeGeometry args={[3.6, 3.6]} />
        <meshBasicMaterial map={tex[idx]} transparent opacity={glyphO} depthWrite={false} color={hot('#ffffff', 1.3)} toneMapped={false} />
      </mesh>
    </>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [64, 67, 80], [0, 0.45, 0], clamp);
  return (
    <AbsoluteFill>
      <Stage bloom={1.4} haze={{ k: 0.3 }}>
        <IntroWorld />
      </Stage>
      <AbsoluteFill style={{ background: D.glow, opacity: flash, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', left: 120, bottom: 120, fontSize: 34 }}>
        <Typed
          text="> DECRYPTING ARCHIVE :: FRINGE / 2012–2013"
          start={6}
          cps={1.1}
          style={{ fontFamily: DF.ui, fontWeight: 600, letterSpacing: '0.08em', color: D.main, textShadow: iceGlow(0.4) }}
        />
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 2. Origin: wireframe terrain flight, hashtag tunnel, #CrossTheLine ─────────────── */
const TERRAIN_W = 70;
const TERRAIN_D = 90;
const SEG_X = 70;
const SEG_Z = 90;
const terrainH = (x: number, z: number) => {
  const side = Math.max(0, Math.abs(x) - 4);
  const n = Math.sin(x * 0.35 + z * 0.21) * Math.cos(z * 0.33 - x * 0.12) + 0.5 * Math.sin(z * 0.9 + x * 0.7);
  return Math.pow(side, 1.15) * 0.22 * (1.1 + n);
};

const Terrain: React.FC<{ scroll: number }> = ({ scroll }) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, SEG_X, SEG_Z).rotateX(-Math.PI / 2), []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i) - scroll));
  pos.needsUpdate = true;
  return (
    <mesh geometry={geo} position={[0, -2, -TERRAIN_D / 2 + 10]}>
      <meshBasicMaterial color={hot(D.main, 1.1)} wireframe toneMapped={false} transparent opacity={0.55} />
    </mesh>
  );
};

const OriginWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ring = spring({ frame: frame - 74, fps, config: { damping: 14, mass: 0.8 } });
  const torus = useMemo(() => new THREE.TorusGeometry(3.2, 0.02, 3, 96), []);
  return (
    <>
      <Cam pos={[0, 1.2 + Math.sin(frame / 30) * 0.15, 12]} look={[0, 0.6, -20]} />
      <Terrain scroll={frame * 0.12} />
      {/* horizon sun: stacked pink rings sinking into the grid */}
      <group position={[0, 2.2, -45]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Circle key={i} r={7 - i * 1.1} color={i % 2 ? D.deep : D.main} opacity={0.35} k={1.3} />
        ))}
      </group>
      <Particles count={400} spread={[80, 20, 60]} seed={7} />
      <Shards frame={frame} count={45} seed={8} center={[7.5, 2.5, -6]} spread={[9, 7, 10]} size={0.5} drift={[-0.01, 0.006, 0.02]} />
      <Shards frame={frame} count={30} seed={9} center={[-9, 3.5, -12]} spread={[8, 6, 8]} size={0.6} drift={[0.01, -0.004, 0.02]} />
      {frame >= 74 && (
        <group position={[0, 0.6, 0]} rotation={[Math.PI / 2 - 0.3 + frame * 0.004, frame * 0.01, 0]} scale={0.3 + ring * 0.9}>
          <Edges geometry={torus} color={D.deep} k={1.8} opacity={ring} />
          <group rotation={[Math.PI / 2, 0, 0]} scale={1.15}>
            <Edges geometry={torus} k={1.6} opacity={ring * 0.6} />
          </group>
        </group>
      )}
    </>
  );
};

// Campaign hashtags streaming past on the four walls of a CSS 3D tunnel.
const HashtagTunnel: React.FC = () => {
  const frame = useCurrentFrame();
  const tags = data.campaigns.map((c) => `#${c.hashtag}`);
  const depth = 4200;
  const per = 12;
  const walls = [
    { t: (z: number, o: number) => `translate3d(-760px, ${o}px, ${z}px) rotateY(90deg)` },
    { t: (z: number, o: number) => `translate3d(760px, ${o}px, ${z}px) rotateY(-90deg)` },
    { t: (z: number, o: number) => `translate3d(${o}px, -430px, ${z}px) rotateX(-90deg) rotateZ(90deg)` },
    { t: (z: number, o: number) => `translate3d(${o}px, 430px, ${z}px) rotateX(90deg) rotateZ(90deg)` },
  ];
  return (
    <AbsoluteFill style={{ perspective: 800, overflow: 'hidden', opacity: interpolate(frame, [0, 16], [0, 1], clamp) }}>
      <AbsoluteFill style={{ background: 'rgba(2,7,11,0.55)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d' }}>
        {walls.flatMap((w, wi) =>
          Array.from({ length: per }).map((_, i) => {
            const z = ((i * (depth / per) + frame * 38 + wi * 90) % depth) - depth + 300;
            const o = ((i * 137 + wi * 61) % 5) * 110 - 220;
            const near = interpolate(z, [-depth + 300, -2000, 100, 300], [0, 1, 1, 0], clamp);
            return (
              <div
                key={`${wi}-${i}`}
                style={{
                  position: 'absolute',
                  transform: `${w.t(z, o)} translate(-50%, -50%)`,
                  fontFamily: DF.ui,
                  fontSize: 70,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: (i + wi) % 5 === 0 ? D.deep : D.main,
                  textShadow: iceGlow(0.5, (i + wi) % 5 === 0 ? D.deep : D.glow),
                  opacity: near * 0.75,
                }}
              >
                {tags[(i * 5 + wi * 7) % tags.length]}
              </div>
            );
          }),
        )}
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${D.bg}f0 18%, transparent 55%)` }} />
    </AbsoluteFill>
  );
};

const FirstHashtag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', transform: `scale(${1.4 - 0.4 * p})`, opacity: p }}>
      <GlitchText
        text="#CrossTheLine"
        start={3}
        dur={14}
        style={{ fontFamily: DF.display, fontSize: 124, color: D.hi, textShadow: iceGlow() }}
      />
      <div
        style={{
          marginTop: 36,
          fontFamily: DF.ui,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '0.2em',
          color: D.main,
          opacity: interpolate(frame, [18, 30], [0, 1], clamp),
        }}
      >
        [ JAN 13, 2012 · CAMPAIGN 01 OF {data.campaigns.length} ]
      </div>
    </AbsoluteFill>
  );
};

export const Origin: React.FC = () => {
  const frame = useCurrentFrame();
  const textOut = interpolate(frame, [62, 74], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Stage bloom={1.2} fog={[10, 55]} haze={{ y: 0.4, k: 0.95 }}>
        <OriginWorld />
      </Stage>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 160px', opacity: textOut, marginTop: -120 }}>
        <Kicker>LOG 001 · INCIDENT REPORT</Kicker>
        <Words
          text="2012. Fringe was facing cancellation."
          highlight={['Fringe']}
          style={{ fontFamily: DF.ui, fontWeight: 700, fontSize: 96, color: D.fg, marginTop: 24, textShadow: '0 4px 30px #000' }}
        />
        <Words
          text="So the fans fought back, one hashtag at a time."
          delay={22}
          stagger={3}
          style={{ fontFamily: DF.ui, fontWeight: 500, fontSize: 70, color: '#B6D8E8', marginTop: 24, textShadow: '0 4px 30px #000' }}
        />
      </AbsoluteFill>
      <Sequence from={66}>
        <HashtagTunnel />
      </Sequence>
      <Sequence from={74}>
        <FirstHashtag />
      </Sequence>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 3. Art wall: tiles fly in to a curved holo-wall, camera pulls back ─────────────── */
const WALL_COLS = 17;
const WALL_ROWS = 7;
const WALL_R = 15;
const WALL_ARC = 1.9; // radians
const TILE = 1.5;
const ART_URLS = art.map((a) => staticFile(`art/${a}`));

const ArtWallWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tex = useTextures(ART_URLS);
  // light grade so the avatars sit in the palette but stay recognisable
  const mats = useMemo(() => Array.from({ length: WALL_COLS * WALL_ROWS }, (_, i) => makeGlyphGrade(tex[(i * 7) % tex.length], 0.3)), [tex]);
  const plane = useMemo(() => new THREE.PlaneGeometry(TILE, TILE), []);
  const rnd = useMemo(() => mulberry(11), []);
  const scatter = useMemo(() => Array.from({ length: WALL_COLS * WALL_ROWS }, () => [rnd() - 0.5, rnd() - 0.5, rnd()] as V3), [rnd]);
  const t = interpolate(frame, [0, 170], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const camZ = interpolate(t, [0, 1], [WALL_R - 3.2, 1.5]);
  const yaw = interpolate(frame, [0, 180], [0.1, -0.12]);
  const cx = (WALL_COLS - 1) / 2;
  const cy = (WALL_ROWS - 1) / 2;
  return (
    <>
      <Cam pos={[Math.sin(yaw) * 2, 0.5 + (1 - t) * 0.4, camZ]} look={[Math.sin(yaw) * 8, 0.3, -WALL_R]} fov={interpolate(t, [0, 1], [28, 50])} />
      <Particles count={400} spread={[60, 20, 50]} seed={21} />
      <Shards frame={frame} count={60} seed={22} center={[0, 0, -4]} spread={[30, 14, 16]} size={0.45} drift={[0.012, 0.004, 0]} />
      <group position={[0, 0, 0]}>
        {scatter.map((s, i) => {
          const x = i % WALL_COLS;
          const y = Math.floor(i / WALL_COLS);
          const dist = Math.hypot(x - cx, (y - cy) * 1.4);
          const p = spring({ frame: frame - dist * 3, fps, config: { damping: 18 } });
          const a = ((x - cx) / (WALL_COLS - 1)) * WALL_ARC;
          const tx = Math.sin(a) * WALL_R;
          const tz = -Math.cos(a) * WALL_R;
          const ty = (cy - y) * (TILE + 0.18);
          const from: V3 = [tx + s[0] * 30, ty + s[1] * 20, tz - 25 - s[2] * 30];
          return (
            <group
              key={i}
              position={[from[0] + (tx - from[0]) * p, from[1] + (ty - from[1]) * p, from[2] + (tz - from[2]) * p]}
              rotation={[(1 - p) * s[0] * 3, -a + (1 - p) * 2.4, 0]}
            >
              <mesh geometry={plane}>
                <primitive object={mats[i]} attach="material" uniforms-opacity-value={p} />
              </mesh>
              <Edges geometry={plane} k={1.3} opacity={0.45 + 0.4 * (1 - p)} />
            </group>
          );
        })}
      </group>
    </>
  );
};

export const ArtWall: React.FC = () => (
  <AbsoluteFill>
    <Stage bloom={0.9} fog={[14, 50]} haze={{ y: 0.3, k: 0.9 }}>
      <ArtWallWorld />
    </Stage>
    <Arcs cx={2300} cy={1700} r0={1000} opacity={0.4} />
    <AbsoluteFill style={{ background: `linear-gradient(0deg, ${D.bg} 4%, ${D.bg}cc 30%, transparent 60%)` }} />
    <div style={{ position: 'absolute', left: 140, bottom: 150, width: 1700 }}>
      <Kicker delay={50}>EVERY FRIDAY · FAN-MADE</Kicker>
      <Words
        text="Artists in the fandom made social media avatars to rally every campaign."
        delay={60}
        highlight={['avatars']}
        style={{ fontFamily: DF.ui, fontWeight: 700, fontSize: 86, lineHeight: 1.05, color: D.fg, marginTop: 20 }}
      />
    </div>
    <CrtOverlay />
  </AbsoluteFill>
);

/* ─────────────── 4. Stats: holo cards, each with a spinning wireframe solid ─────────────── */
const STATS = [
  { value: data.totalImages, label: 'AVATARS', sub: 'archived & searchable' },
  { value: data.campaigns.length, label: 'CAMPAIGNS', sub: 'one per episode night' },
  { value: data.episodes, label: 'EPISODES', sub: 'season 4 → series finale' },
  { value: data.artists, label: 'ARTISTS', sub: 'credited by name' },
];
const CARD = { w: 380, h: 470, top: 430, left: 140, gap: 40 };
const cardX = (i: number) => CARD.left + i * (CARD.w + CARD.gap);
const statDelay = (i: number) => 24 + i * 12;

const StatsWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const solids = useMemo(
    () => [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1.2, 0),
    ],
    [],
  );
  const globe = useMemo(() => new THREE.IcosahedronGeometry(9, 3), []);
  return (
    <>
      <group position={[9, -1, -14]} rotation={[0.3, frame * 0.006, 0]}>
        <mesh geometry={globe}>
          <meshBasicMaterial color={D.main} wireframe transparent opacity={0.12} />
        </mesh>
      </group>
      <Particles count={400} spread={[40, 24, 20]} seed={5} rotY={frame * 0.001} />
      <Shards frame={frame} count={40} seed={6} center={[8, 3, -8]} spread={[12, 8, 6]} size={0.45} drift={[-0.008, 0.01, 0]} />
      {solids.map((g, i) => {
        const p = spring({ frame: frame - statDelay(i), fps, config: { damping: 14 } });
        const [x, y] = px(cardX(i) + CARD.w / 2, CARD.top + 110);
        return (
          <group key={i} position={[x, y, 0]} rotation={[frame * 0.02 + i, frame * 0.03 + i * 2, 0]} scale={pxSize(62) * p}>
            <Edges geometry={g} color={i === 0 ? D.deep : D.main} k={1.8} />
          </group>
        );
      })}
    </>
  );
};

const StatCard: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stat = STATS[i];
  const delay = statDelay(i);
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  const count = interpolate(frame - delay, [4, 50], [0, stat.value], { ...clamp, easing: Easing.out(Easing.cubic) });
  const segs = 20;
  const lit = Math.round(interpolate(frame - delay, [4, 50], [0, segs], clamp));
  return (
    <div style={{ position: 'absolute', left: cardX(i), top: CARD.top, opacity: Math.min(1, enter * 1.5), transform: `translateY(${(1 - enter) * 60}px)` }}>
      <HudPanel w={CARD.w} h={CARD.h} progress={enter} color={i === 0 ? D.deep : D.main}>
        <div style={{ position: 'absolute', top: 14, left: 44, fontFamily: DF.ui, fontWeight: 600, fontSize: 20, letterSpacing: '0.2em', color: D.muted }}>
          DATA.{String(i + 1).padStart(2, '0')}
        </div>
        <div style={{ position: 'absolute', top: 220, left: 36, right: 36 }}>
          <div style={{ fontFamily: DF.display, fontSize: 70, lineHeight: 1, filter: `drop-shadow(0 0 10px rgba(80,185,235,0.55))` }}>
            <span style={metalText}>{fmt(count)}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
            {Array.from({ length: segs }).map((_, s) => (
              <span key={s} style={{ flex: 1, height: 8, background: s < lit ? D.main : 'rgba(108,200,238,0.15)', boxShadow: s < lit ? `0 0 8px ${D.glow}` : undefined }} />
            ))}
          </div>
          <div style={{ fontFamily: DF.ui, fontWeight: 700, fontSize: 36, color: i === 0 ? D.deep : D.main, letterSpacing: '0.16em', marginTop: 22 }}>
            {stat.label}
          </div>
          <div style={{ fontFamily: DF.ui, fontWeight: 500, fontSize: 28, color: '#ABCDDD', marginTop: 4 }}>{stat.sub}</div>
        </div>
      </HudPanel>
    </div>
  );
};

export const Stats: React.FC = () => (
  <AbsoluteFill>
    <Stage bloom={1.2} haze={{ x: 0.7, y: 0.4, k: 0.85, flare: 0.55 }}>
      <StatsWorld />
    </Stage>
    <div style={{ position: 'absolute', left: 140, top: 150 }}>
      <Kicker>THE ARCHIVE, BY THE NUMBERS</Kicker>
      <Words
        text="A whole year of fandom, preserved."
        delay={6}
        highlight={['preserved.']}
        style={{ fontFamily: DF.ui, fontWeight: 700, fontSize: 92, color: D.fg, marginTop: 16 }}
      />
    </div>
    {STATS.map((s, i) => (
      <StatCard key={s.label} i={i} />
    ))}
    <CrtOverlay />
  </AbsoluteFill>
);

/* ─────────────── 5. Timeline: wireframe 3D bar chart with an orbiting camera ─────────────── */
const parseDate = (d: string) => new Date(d.replace(/(\d+)(st|nd|rd|th)/, '$1')).getTime();
const T0 = new Date('January 1, 2012').getTime();
const T1 = new Date('February 1, 2013').getTime();
const MONTHS = ['JAN 2012', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN 2013'];
const X0 = -13;
const X1 = 13;
const MAX_H = 6.5;
const BAR = 0.55;
const xOf = (t: number) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
const MAX_COUNT = Math.max(...data.campaigns.map((c) => c.count));
const TOP = data.campaigns.reduce((a, b) => (b.count > a.count ? b : a));
const LAST_S4 = data.campaigns.findIndex((c) => c.episodeId.startsWith('5')) - 1;
const cxOf = (i: number) => xOf(parseDate(data.campaigns[i].date));

const timelineCam = (frame: number) => {
  const t = interpolate(frame, [0, 190], [0, 1], { easing: Easing.inOut(Easing.sin) });
  const ang = interpolate(t, [0, 1], [0.55, -0.12]);
  const r = interpolate(t, [0, 1], [26, 24]);
  const pos: V3 = [Math.sin(ang) * r, interpolate(t, [0, 1], [2.5, 6]), Math.cos(ang) * r];
  const look: V3 = [interpolate(t, [0, 1], [-2, 0.5]), 2.4, 0];
  return { pos, look, fov: 40 };
};

const Bar: React.FC<{ x: number; h: number; hotBar: boolean }> = ({ x, h, hotBar }) => {
  const box = useMemo(() => new THREE.BoxGeometry(BAR, 1, BAR), []);
  if (h <= 0.001) return null;
  return (
    <group position={[x, h / 2, 0]} scale={[1, h, 1]}>
      <mesh geometry={box}>
        <meshBasicMaterial color={hotBar ? hot(D.main, 1.3) : '#0a2636'} toneMapped={!hotBar} transparent opacity={hotBar ? 0.75 : 0.6} depthWrite={false} />
      </mesh>
      <Edges geometry={box} color={hotBar ? D.hi : D.main} k={hotBar ? 2.4 : 1.4} />
    </group>
  );
};

const TimelineWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = timelineCam(frame);
  const axis = interpolate(frame, [10, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const hiatusA = cxOf(LAST_S4) + 0.5;
  const hiatusB = cxOf(LAST_S4 + 1) - 0.5;
  const hiatusBox = useMemo(() => new THREE.BoxGeometry(hiatusB - hiatusA, 3, 1.6), [hiatusA, hiatusB]);
  const axisGeo = useMemo(() => new THREE.BoxGeometry(X1 - X0, 0.04, 0.04), []);
  return (
    <>
      <Cam {...cam} />
      <FloorGrid y={0} size={80} step={1} opacity={0.1} />
      <Particles count={400} spread={[70, 30, 50]} seed={9} />
      <Shards frame={frame} count={50} seed={10} center={[0, 9, -14]} spread={[50, 10, 12]} size={0.55} drift={[0.015, 0.003, 0]} />
      <mesh geometry={axisGeo} position={[X0 + ((X1 - X0) * axis) / 2, 0.02, 0.6]} scale={[Math.max(axis, 0.001), 1, 1]}>
        <meshBasicMaterial color={hot(D.main, 2)} toneMapped={false} />
      </mesh>
      {data.campaigns.map((c, i) => {
        const p = spring({ frame: frame - 30 - i * 2.2, fps, config: { damping: 15 } });
        return <Bar key={c.hashtag} x={cxOf(i)} h={(c.count / MAX_COUNT) * MAX_H * p} hotBar={c === TOP} />;
      })}
      <group position={[(hiatusA + hiatusB) / 2, 1.5, 0]}>
        <Edges geometry={hiatusBox} color={D.muted} k={0.9} opacity={interpolate(frame, [70, 85], [0, 0.6], clamp)} />
      </group>
    </>
  );
};

const Label: React.FC<{ at: V3; frame: number; style?: React.CSSProperties; children: React.ReactNode; anchor?: 'center' | 'right' | 'left' }> = ({
  at,
  frame,
  style,
  children,
  anchor = 'center',
}) => {
  const { pos, look, fov } = timelineCam(frame);
  const { x, y } = project(at, pos, look, fov);
  const tx = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0';
  return <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tx}, -50%)`, whiteSpace: 'nowrap', ...style }}>{children}</div>;
};

export const Timeline: React.FC = () => {
  const frame = useCurrentFrame();
  const late = interpolate(frame, [110, 125], [0, 1], clamp);
  const topI = data.campaigns.indexOf(TOP);
  return (
    <AbsoluteFill>
      <Stage bloom={1.1} fog={[18, 60]} haze={{ y: 0.35, k: 0.8 }}>
        <TimelineWorld />
      </Stage>
      <div style={{ position: 'absolute', left: 140, top: 120 }}>
        <Kicker>JAN 2012 → JAN 2013</Kicker>
        <Words text="Every campaign. Every Friday night." delay={4} style={{ fontFamily: DF.ui, fontWeight: 700, fontSize: 84, color: D.fg, marginTop: 14 }} />
      </div>
      {MONTHS.map((m, i) => (
        <Label
          key={i}
          at={[xOf(new Date(2012, i, 1).getTime()), 0, 1.6]}
          frame={frame}
          style={{ fontFamily: DF.ui, fontWeight: 600, fontSize: 22, color: D.muted, opacity: interpolate(frame, [14 + i * 2, 24 + i * 2], [0, 1], clamp) }}
        >
          {m}
        </Label>
      ))}
      {[
        { label: 'SEASON 4', a: 0, b: LAST_S4 },
        { label: 'SEASON 5 · FINAL SEASON', a: LAST_S4 + 1, b: data.campaigns.length - 1 },
      ].map((s) => (
        <Label
          key={s.label}
          at={[(cxOf(s.a) + cxOf(s.b)) / 2, 0, 4]}
          frame={frame}
          style={{
            fontFamily: DF.ui,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '0.15em',
            color: D.main,
            padding: '6px 14px',
            border: `1px solid ${D.main}`,
            background: 'rgba(2,7,11,0.7)',
            opacity: interpolate(frame, [80, 95], [0, 1], clamp),
          }}
        >
          {s.label}
        </Label>
      ))}
      <Label
        at={[(cxOf(LAST_S4) + cxOf(LAST_S4 + 1)) / 2, 3.4, 0]}
        frame={frame}
        style={{ fontFamily: DF.ui, fontWeight: 600, fontSize: 24, letterSpacing: '0.2em', color: D.muted, opacity: interpolate(frame, [70, 85], [0, 1], clamp) }}
      >
        SUMMER HIATUS
      </Label>
      <Label
        at={[cxOf(0) - 0.3, (data.campaigns[0].count / MAX_COUNT) * MAX_H + 0.8, 0]}
        anchor="left"
        frame={frame}
        style={{ fontFamily: DF.ui, fontWeight: 600, fontSize: 28, color: D.fg, opacity: interpolate(frame, [95, 108], [0, 1], clamp) }}
      >
        ▼ #{data.campaigns[0].hashtag}: where it began
      </Label>
      <Label at={[cxOf(topI) - 0.7, MAX_H * 0.72, 0]} anchor="right" frame={frame} style={{ textAlign: 'right', opacity: late }}>
        <div style={{ fontFamily: DF.display, fontSize: 56, color: D.hi, textShadow: iceGlow(0.6) }}>{TOP.count}</div>
        <div style={{ fontFamily: DF.ui, fontWeight: 600, fontSize: 28, color: D.fg }}>#{TOP.hashtag} · the series finale ▶</div>
      </Label>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 6. Product: site screenshots as layered holographic panels ─────────────── */
const SHOTS = ['site-gallery.png', 'site-gallery2.png', 'site-lightbox.png'].map((s) => staticFile(s));
const PANEL_W = 9.6;
const PANEL_H = 6;
const PANEL_POS: V3 = [-3.1, 0.5, 0];

const productCam = (frame: number) => {
  const t = interpolate(frame, [0, 220], [0, 1], { easing: Easing.inOut(Easing.sin) });
  return { pos: [interpolate(t, [0, 1], [4, 1.2]), interpolate(t, [0, 1], [1.6, 0.6]), interpolate(t, [0, 1], [17, 14.5])] as V3, look: [-0.8, 0.3, 0] as V3 };
};

const enterOf = (frame: number, fps: number) => spring({ frame, fps, config: { damping: 20 } });
const scrollOf = (frame: number) => interpolate(frame, [40, 90], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
const lbOf = (frame: number, fps: number) => spring({ frame: frame - 115, fps, config: { damping: 16 } });

const ProductWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tex = useTextures(SHOTS);
  const [g0, g1, g2] = [useGlyphGrade(tex[0], 0.55), useGlyphGrade(tex[1], 0.55), useGlyphGrade(tex[2], 0.55)];
  g0.uniforms.opacity.value = enterOf(frame, fps) * (1 - scrollOf(frame));
  g1.uniforms.opacity.value = enterOf(frame, fps) * scrollOf(frame);
  g2.uniforms.opacity.value = lbOf(frame, fps);
  const cam = productCam(frame);
  const enter = enterOf(frame, fps);
  const scroll = scrollOf(frame);
  const lb = lbOf(frame, fps);
  const plane = useMemo(() => new THREE.PlaneGeometry(PANEL_W, PANEL_H), []);
  const scanY = ((frame * 0.05) % 1.2) * PANEL_H - PANEL_H * 0.6;
  return (
    <>
      <Cam {...cam} />
      <Particles count={300} spread={[50, 20, 30]} seed={13} />
      <Shards frame={frame} count={55} seed={14} center={[8, 3.5, -5]} spread={[10, 8, 8]} size={0.5} drift={[-0.006, 0.012, 0.004]} />
      <group position={[-6, -1, -9]} rotation={[0.2, 0.6, 0.3]}>
        <TriNet w={16} h={9} nx={22} ny={12} bend={0.05} opacity={0.12} />
      </group>
      <group position={[PANEL_POS[0] - (1 - enter) * 8, PANEL_POS[1], PANEL_POS[2]]} rotation={[0.04, interpolate(frame, [0, 220], [0.38, 0.16]), 0]}>
        <mesh geometry={plane} position={[0, -scroll * 0.3, 0]} material={g0} />
        <mesh geometry={plane} position={[0, (1 - scroll) * 0.3, 0.001]} material={g1} />
        <Edges geometry={plane} k={1.8} opacity={enter} />
        {/* lightbox layer floats out toward the camera */}
        <group position={[0.6, -0.3, 0.02 + lb * 1.6]} scale={0.9 + 0.08 * lb} visible={lb > 0.01}>
          <mesh geometry={plane} material={g2} />
          <Edges geometry={plane} color={D.hi} k={1.8} opacity={lb} />
        </group>
        {/* scan bar sweeping the panel */}
        <mesh position={[0, scanY, 0.01]}>
          <planeGeometry args={[PANEL_W, 0.03]} />
          <meshBasicMaterial color={hot(D.main, 2.5)} toneMapped={false} transparent opacity={0.8 * enter} />
        </mesh>
      </group>
    </>
  );
};

// The gallery's features as a game main menu; the highlight steps down in time with the screenshots.
const MENU = [
  { t: `BROWSE ALL ${data.campaigns.length} CAMPAIGNS`, s: 'From January 2012 to January 2013, episode by episode.', at: 26 },
  { t: 'EVERY ARTIST CREDITED', s: 'Each avatar links to the artist who made it.', at: 72 },
  { t: 'OPEN ANY AVATAR FULL SIZE', s: 'With a share link for every image.', at: 118 },
];

export const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const url = interpolate(frame, [20, 34], [0, 1], clamp);
  const sel = MENU.reduce((acc, m, i) => (frame >= m.at ? i : acc), 0);
  const selIn = interpolate(frame - MENU[sel].at, [0, 8], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Stage bloom={0.8} haze={{ x: 0.35, y: 0.45, k: 0.9, flare: 0.8 }}>
        <ProductWorld />
      </Stage>
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 132,
          fontFamily: DF.ui,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: '0.1em',
          color: D.main,
          opacity: url,
          padding: '6px 18px',
          border: `1px solid rgba(108,200,238,0.5)`,
          background: 'rgba(2,7,11,0.6)',
        }}
      >
        SOURCE ▸ https://fringematrix.art
      </div>
      <div style={{ position: 'absolute', left: 1240, top: 270, width: 600 }}>
        <div
          style={{
            fontFamily: DF.ui,
            fontWeight: 600,
            fontSize: 76,
            color: D.main,
            textShadow: iceGlow(0.5),
            opacity: interpolate(frame, [10, 22], [0, 1], clamp),
          }}
        >
          The Gallery
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
          {MENU.map((m, i) => (
            <MenuBar
              key={m.t}
              w={i === sel ? 600 : 560}
              label={m.t}
              active={i === sel ? selIn : i === sel - 1 ? 1 - selIn : 0}
              progress={spring({ frame: frame - 18 - i * 5, fps, config: { damping: 18 } })}
            />
          ))}
        </div>
        <div
          key={sel}
          style={{
            marginTop: 30,
            fontFamily: DF.ui,
            fontWeight: 500,
            fontSize: 32,
            lineHeight: 1.3,
            color: D.fg,
            opacity: frame >= MENU[0].at ? selIn : 0,
            transform: `translateY(${(1 - selIn) * 10}px)`,
          }}
        >
          {MENU[sel].s}
        </div>
      </div>
      <CrtOverlay />
    </AbsoluteFill>
  );
};

/* ─────────────── 7. End card: gyroscope rings + orbiting glyphs ─────────────── */
const OutroWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const tex = useTextures(GLYPH_URLS);
  const torus = useMemo(() => new THREE.TorusGeometry(1, 0.004, 3, 128), []);
  const glyphPlane = useMemo(() => new THREE.PlaneGeometry(1.4, 1.4), []);
  const inR = (i: number) => interpolate(frame, [i * 4, i * 4 + 20], [0, 1], clamp);
  return (
    <>
      <Cam pos={[0, 0.4, 14]} />
      <Particles count={500} spread={[50, 30, 40]} seed={17} rotY={frame * 0.002} />
      <Shards frame={frame} count={80} seed={18} center={[0, 0, -4]} spread={[30, 18, 12]} size={0.45} drift={[0.006, 0.008, 0]} opacity={interpolate(frame, [0, 20], [0, 1], clamp)} />
      {[
        { r: 5.6, rot: [1.25, 0, frame * 0.004] as V3, c: D.main },
        { r: 6.2, rot: [1.1 + frame * 0.003, frame * 0.006, 0] as V3, c: D.deep },
        { r: 6.8, rot: [1.4, frame * -0.005, 0.3] as V3, c: D.main },
      ].map((g, i) => (
        <group key={i} rotation={g.rot} scale={g.r * inR(i)}>
          <Edges geometry={torus} color={g.c} k={1.5} opacity={0.6} />
        </group>
      ))}
      <group rotation={[1.2, 0, 0]}>
        <group rotation={[0, 0, frame * 0.006]}>
          {GLYPHS.map((g, i) => {
            const a = (i / GLYPHS.length) * Math.PI * 2;
            return (
              <mesh key={g} geometry={glyphPlane} position={[Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0]} rotation={[-1.2, 0, 0]}>
                <meshBasicMaterial
                  map={tex[i]}
                  transparent
                  opacity={0.8 * interpolate(frame, [i * 3, i * 3 + 15], [0, 1], clamp)}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
      </group>
    </>
  );
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = 'FRINGE MATRIX';
  const sub = 'FAN ART ARCHIVE';
  const restored = spring({ frame: frame - 30, fps, config: { damping: 16 } });
  const url = spring({ frame: frame - 50, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Stage bloom={1.3} haze={{ k: 0.85, flare: 0.5 }}>
        <OutroWorld />
      </Stage>
      <Arcs cx={-400} cy={1600} r0={1100} opacity={0.35} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', fontFamily: DF.display, fontSize: 132, lineHeight: 1, filter: 'drop-shadow(0 0 14px rgba(60,170,230,0.5)) drop-shadow(0 4px 8px #000)' }}>
            {title.split('').map((ch, i) => {
              const p = spring({ frame: frame - i * 2, fps, config: { damping: 12 } });
              const scramble = p < 0.9 && ch !== ' ' ? String.fromCharCode(65 + ((frame * 7 + i * 13) % 26)) : ch;
              return (
                <span key={i} style={{ ...metalText, opacity: p, transform: `translateY(${(1 - p) * -30}px)`, whiteSpace: 'pre', display: 'inline-block' }}>
                  {scramble}
                </span>
              );
            })}
          </div>
          <div
            style={{
              alignSelf: 'stretch',
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 18,
              padding: '0 6px',
              fontFamily: DF.ui,
              fontWeight: 600,
              fontSize: 40,
              color: D.fg,
              opacity: interpolate(frame, [16, 30], [0, 1], clamp),
            }}
          >
            {/* spread across the logo's width, like HUMAN REVOLUTION under DEUS EX; a space becomes one empty slot */}
            {sub.split('').map((ch, i) => (
              <span key={i}>{ch === ' ' ? '' : ch}</span>
            ))}
          </div>
          {/* the Director's Cut bar: bright band with a triangle notch, dark lettering */}
          <div style={{ alignSelf: 'stretch', position: 'relative', height: 50, marginTop: 14, clipPath: `inset(0 ${(1 - restored) * 100}% 0 0)` }}>
            <svg width="100%" height="50" viewBox="0 0 1000 50" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <linearGradient id="dcbar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#DDF4FF" />
                  <stop offset="0.5" stopColor="#6CC8EE" />
                  <stop offset="1" stopColor="#2A6C92" />
                </linearGradient>
              </defs>
              <polygon points="0,50 60,0 1000,0 970,50" fill="url(#dcbar)" />
              <polygon points="110,0 175,50 200,50 135,0" fill={D.bg} opacity={0.85} />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 60,
                fontFamily: DF.ui,
                fontWeight: 700,
                fontSize: 36,
                letterSpacing: '0.3em',
                color: '#031018',
              }}
            >
              RESTORED
            </div>
          </div>
        </div>
        <Words
          text="The fan art of the Fringe campaigns, preserved."
          delay={26}
          stagger={2}
          style={{ fontFamily: DF.ui, fontWeight: 500, fontSize: 40, color: '#B6D8E8', marginTop: 34, justifyContent: 'center' }}
        />
        <div style={{ marginTop: 44 }}>
          <MenuBar w={520} h={84} fontSize={48} label="fringematrix.art" active={interpolate(frame, [62, 72], [0, 1], clamp)} progress={url} />
        </div>
      </AbsoluteFill>
      <CrtOverlay />
    </AbsoluteFill>
  );
};
