import { useEffect, useMemo } from 'react';
import { continueRender, delayRender, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { C } from '../theme';

export type V3 = [number, number, number];

// Colors pushed past 1.0 (with toneMapped={false}) so the bloom pass picks them up.
export const hot = (hex: string, k = 1.6) => new THREE.Color(hex).multiplyScalar(k);

const CA_OFFSET = new THREE.Vector2(0.0009, 0.0006);

// Full-frame WebGL canvas with the shared look: dark fog, bloom, slight chromatic fringing, vignette.
export const Stage: React.FC<{ children: React.ReactNode; bloom?: number; fog?: [number, number] }> = ({
  children,
  bloom = 1.1,
  fog = [14, 60],
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 35, position: [0, 0, 12], near: 0.1, far: 300 }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, fog[0], fog[1]]} />
      {children}
      <EffectComposer multisampling={4}>
        <Bloom intensity={bloom} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
        <ChromaticAberration offset={CA_OFFSET} radialModulation={false} modulationOffset={0} />
        <Vignette darkness={0.7} offset={0.25} />
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
  color = C.cyan,
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
      <lineBasicMaterial color={C.cyan} transparent opacity={opacity} />
    </lineSegments>
  );
};

// Deterministic star/particle field.
export const Particles: React.FC<{ count?: number; spread?: V3; size?: number; color?: string; seed?: number; rotY?: number }> = ({
  count = 600,
  spread = [60, 30, 60],
  size = 0.06,
  color = C.cyan,
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
