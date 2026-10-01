import { useEffect, useMemo } from 'react';
import { continueRender, delayRender, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { D } from './dx';

export type V3 = [number, number, number];

// Colors pushed past 1.0 (with toneMapped={false}) so the bloom pass picks them up.
export const hot = (hex: string, k = 1.6) => new THREE.Color(hex).multiplyScalar(k);

const CA_OFFSET = new THREE.Vector2(0.0009, 0.0006);

export type Haze = { x?: number; y?: number; k?: number; flare?: number };

// Screen-space background: a glyph-blue glow fading to black, plus an optional hot flare off the right edge.
const useHazeTexture = ({ x = 0.5, y = 0.45, k = 1, flare = 0 }: Haze) =>
  useMemo(() => {
    const W = 960;
    const H = 540;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.fillStyle = D.bg;
    g.fillRect(0, 0, W, H);
    const blob = (cx: number, cy: number, r: number, stops: [number, string][]) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      stops.forEach(([o, c]) => grad.addColorStop(o, c));
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    };
    g.globalCompositeOperation = 'lighter';
    blob(x * W, y * H, W * 0.62, [
      [0, `rgba(28,96,140,${0.95 * k})`],
      [0.35, `rgba(12,54,84,${0.7 * k})`],
      [0.7, `rgba(4,20,32,${0.5 * k})`],
      [1, 'rgba(0,0,0,0)'],
    ]);
    if (flare > 0) {
      blob(W * 1.02, H * 0.55, W * 0.4, [
        [0, `rgba(225,248,255,${flare})`],
        [0.18, `rgba(120,205,245,${0.75 * flare})`],
        [0.55, `rgba(24,88,140,${0.35 * flare})`],
        [1, 'rgba(0,0,0,0)'],
      ]);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [x, y, k, flare]);

// Full-frame WebGL canvas with the shared look: blue haze, fog and key light, bloom, slight fringing, vignette.
export const Stage: React.FC<{ children: React.ReactNode; bloom?: number; fog?: [number, number]; haze?: Haze }> = ({
  children,
  bloom = 1.1,
  fog = [14, 60],
  haze = {},
}) => {
  const { width, height } = useVideoConfig();
  const bg = useHazeTexture(haze);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 35, position: [0, 0, 12], near: 0.1, far: 300 }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <primitive attach="background" object={bg} />
      <fog attach="fog" args={[D.fog, fog[0], fog[1]]} />
      {/* only the lit shards use these; everything else is unlit line work */}
      <ambientLight intensity={0.08} color="#a8dcf2" />
      <directionalLight position={[6, 8, 5]} intensity={6} color="#c8eefc" />
      <directionalLight position={[-8, -3, 2]} intensity={0.5} color="#3789af" />
      {children}
      <EffectComposer multisampling={4}>
        <Bloom intensity={bloom} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
        <ChromaticAberration offset={CA_OFFSET} radialModulation={false} modulationOffset={0} />
        <Vignette darkness={0.75} offset={0.22} />
      </EffectComposer>
      <RenderAfterMount />
    </ThreeCanvas>
  );
};

// EffectComposer attaches its passes in effects that run after ThreeCanvas's own first advance(), so the first
// frame after mount comes out black. Draw once more after mount and hold the screenshot until then.
const RenderAfterMount: React.FC = () => {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const handle = delayRender('Re-rendering after EffectComposer mounted');
    const id = requestAnimationFrame(() => {
      advance(performance.now());
      continueRender(handle);
    });
    return () => {
      cancelAnimationFrame(id);
      continueRender(handle);
    };
  }, [advance]);
  return null;
};

// Drives the default camera from props so every shot is a pure function of the frame.
export const Cam: React.FC<{ pos: V3; look?: V3; fov?: number }> = ({ pos, look = [0, 0, 0], fov = 35 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pos);
  camera.lookAt(...look);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  return null;
};

// Screen-space position (px) of a world point for a given camera, so HTML labels can track 3D objects.
const projector = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 300);
export const project = (p: V3, pos: V3, look: V3 = [0, 0, 0], fov = 35, w = 1920, h = 1080) => {
  projector.fov = fov;
  projector.aspect = w / h;
  projector.position.set(...pos);
  projector.lookAt(...look);
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(projector);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
};

// For static shots with the default camera (z=12, fov 35): converts a pixel position to world units at z=0.
const UNIT = (2 * 12 * Math.tan((35 / 2) * (Math.PI / 180))) / 1080;
export const px = (x: number, y: number): V3 => [(x - 960) * UNIT, (540 - y) * UNIT, 0];
export const pxSize = (n: number) => n * UNIT;

// Crisp outline of any geometry (box edges, polyhedron edges) rather than the triangle soup of `wireframe`.
export const Edges: React.FC<{ geometry: THREE.BufferGeometry; color?: string; k?: number; opacity?: number }> = ({
  geometry,
  color = D.main,
  k = 1.6,
  opacity = 1,
}) => {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={hot(color, k)} toneMapped={false} transparent opacity={opacity} />
    </lineSegments>
  );
};

// Flat grid of lines on the XZ plane.
export const FloorGrid: React.FC<{ size?: number; step?: number; y?: number; opacity?: number; offsetZ?: number }> = ({
  size = 60,
  step = 2,
  y = 0,
  opacity = 0.25,
  offsetZ = 0,
}) => {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const h = size / 2;
    for (let v = -h; v <= h; v += step) {
      pts.push(v, 0, -h, v, 0, h, -h, 0, v, h, 0, v);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [size, step]);
  return (
    <lineSegments geometry={geo} position={[0, y, offsetZ % step]}>
      <lineBasicMaterial color={D.main} transparent opacity={opacity} />
    </lineSegments>
  );
};

// Deterministic star/particle field.
export const Particles: React.FC<{ count?: number; spread?: V3; size?: number; color?: string; seed?: number; rotY?: number }> = ({
  count = 600,
  spread = [60, 30, 60],
  size = 0.06,
  color = D.hi,
  seed = 1,
  rotY = 0,
}) => {
  const geo = useMemo(() => {
    const rnd = mulberry(seed);
    const pts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pts[i * 3] = (rnd() - 0.5) * spread[0];
      pts[i * 3 + 1] = (rnd() - 0.5) * spread[1];
      pts[i * 3 + 2] = (rnd() - 0.5) * spread[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, [count, spread, seed]);
  return (
    <points geometry={geo} rotation={[0, rotY, 0]}>
      <pointsMaterial color={hot(color, 1.4)} size={size} toneMapped={false} transparent opacity={0.8} sizeAttenuation />
    </points>
  );
};

export const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Drifting slivers of blue-and-black glass, lit by the stage's key light: the shattered-triangle motif of the
// Deus Ex: Human Revolution menus. Positions wrap inside `spread` around `center`; `burst` pushes them outward.
export const Shards: React.FC<{
  count?: number;
  seed?: number;
  frame: number;
  center?: V3;
  spread?: V3;
  size?: number;
  drift?: V3;
  spin?: number;
  burst?: number;
  opacity?: number;
}> = ({ count = 80, seed = 1, frame, center = [0, 0, 0], spread = [20, 12, 10], size = 0.5, drift = [0, 0.004, 0], spin = 1, burst = 1, opacity = 1 }) => {
  const mesh = useMemo(() => {
    const geo = new THREE.TetrahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: '#4a9cc4',
      emissive: '#00060a',
      metalness: 0.55,
      roughness: 0.28,
      flatShading: true,
      transparent: true,
    });
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    return m;
  }, [count]);
  const base = useMemo(() => {
    const rnd = mulberry(seed);
    return Array.from({ length: count }, () => ({
      p: [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5] as V3,
      r: [rnd() * 6, rnd() * 6, rnd() * 6] as V3,
      w: [(rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.03] as V3,
      s: [0.5 + rnd(), 0.35 + rnd() * 0.6, 0.18 + rnd() * 0.3] as V3,
      k: Math.pow(rnd(), 2.2) * 1.6 + 0.25,
      v: 0.6 + rnd() * 0.8,
    }));
  }, [count, seed]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const wrap = (n: number) => ((((n + 0.5) % 1) + 1) % 1) - 0.5;
  base.forEach((b, i) => {
    const f = frame * b.v;
    pos.set(
      center[0] + wrap(b.p[0] + (drift[0] * f) / spread[0]) * spread[0] * burst,
      center[1] + wrap(b.p[1] + (drift[1] * f) / spread[1]) * spread[1] * burst,
      center[2] + wrap(b.p[2] + (drift[2] * f) / spread[2]) * spread[2] * burst,
    );
    e.set(b.r[0] + b.w[0] * frame * spin, b.r[1] + b.w[1] * frame * spin, b.r[2] + b.w[2] * frame * spin);
    q.setFromEuler(e);
    const k = size * b.k;
    scl.set(b.s[0] * k, b.s[1] * k, b.s[2] * k);
    mesh.setMatrixAt(i, m4.compose(pos, q, scl));
  });
  mesh.instanceMatrix.needsUpdate = true;
  (mesh.material as THREE.MeshStandardMaterial).opacity = opacity;
  return <primitive object={mesh} />;
};

// Triangulated net (a subdivided plane drawn as wireframe), bent into a shallow curve.
export const TriNet: React.FC<{ w: number; h: number; nx?: number; ny?: number; bend?: number; opacity?: number; color?: string }> = ({
  w,
  h,
  nx = 24,
  ny = 14,
  bend = 0.15,
  opacity = 0.2,
  color = D.main,
}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, nx, ny);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, -bend * Math.pow(p.getX(i), 2));
    return g;
  }, [w, h, nx, ny, bend]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={hot(color, 1.2)} wireframe transparent opacity={opacity} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

// Textured material that maps the image's luminance onto a black-to-glyph-blue ramp, blended with the original by
// `amount`. Used for avatars and screenshots so they sit in the palette; the glyphs deliberately skip it.
export const makeGlyphGrade = (map: THREE.Texture, amount: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, amount: { value: amount }, opacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform float amount; uniform float opacity; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        vec3 ramp = mix(vec3(0.004, 0.018, 0.03), vec3(0.06, 0.36, 0.62), smoothstep(0.0, 0.55, l));
        ramp = mix(ramp, vec3(0.78, 0.94, 1.0), smoothstep(0.55, 1.0, l));
        gl_FragColor = vec4(mix(c.rgb, ramp, amount), c.a * opacity);
        #include <colorspace_fragment>
      }`,
  });

export const useGlyphGrade = (map: THREE.Texture, amount: number) => useMemo(() => makeGlyphGrade(map, amount), [map, amount]);
