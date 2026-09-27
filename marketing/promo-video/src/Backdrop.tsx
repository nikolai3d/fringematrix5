import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from './theme';

// Moving cyan grid + CRT scanlines + vignette, shared by every scene.
export const Backdrop: React.FC<{ gridOpacity?: number }> = ({ gridOpacity = 0.12 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.6) % 80;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #0d1c2b 0%, ${C.bg} 70%)` }}>
      <AbsoluteFill
        style={{
          opacity: gridOpacity,
          backgroundImage: `linear-gradient(${C.cyan} 1px, transparent 1px), linear-gradient(90deg, ${C.cyan} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          backgroundPosition: `0 ${offset}px`,
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const CrtOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker = 0.9 + 0.1 * Math.sin(frame * 1.7) * Math.sin(frame * 0.31);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          opacity: 0.18 * flicker,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, transparent 2px, transparent 4px)',
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)' }} />
    </AbsoluteFill>
  );
};
