import { AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { HudFrame } from './hud';
import { ArtWall, Intro, Origin, Outro, Product, Stats, Timeline } from './scenes';

// Same script and timing as the flat promo (../Promo.tsx), rebuilt as 3D wireframe scenes under a HUD.
const SCENES = [
  { C: Intro, d: 110, label: 'DECRYPT' },
  { C: Origin, d: 170, label: 'ORIGIN' },
  { C: ArtWall, d: 180, label: 'ARCHIVE SCAN' },
  { C: Stats, d: 170, label: 'TELEMETRY' },
  { C: Timeline, d: 190, label: 'TIMELINE' },
  { C: Product, d: 220, label: 'INTERFACE' },
  { C: Outro, d: 160, label: 'RESTORED' },
];
const T = 15;
const TRANSITIONS: TransitionPresentation<any>[] = [fade(), fade(), slide({ direction: 'from-bottom' }), wipe({ direction: 'from-left' }), fade(), fade()];

export const WIRE_DURATION = SCENES.reduce((n, s) => n + s.d, 0) - T * (SCENES.length - 1);
const SECTIONS = SCENES.map((s, i) => ({ from: SCENES.slice(0, i).reduce((n, p) => n + p.d - T, 0), label: s.label }));

export const WirePromo: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#06090f' }}>
      <TransitionSeries>
        {SCENES.flatMap(({ C, d }, i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
            <C />
          </TransitionSeries.Sequence>,
          i < TRANSITIONS.length ? (
            <TransitionSeries.Transition key={`t${i}`} presentation={TRANSITIONS[i]} timing={linearTiming({ durationInFrames: T })} />
          ) : null,
        ])}
      </TransitionSeries>
      <HudFrame sections={SECTIONS} />
      <Audio
        src={staticFile('soundtrack.wav')}
        volume={(f) => interpolate(f, [0, 20, durationInFrames - 40, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateRight: 'clamp' })}
      />
    </AbsoluteFill>
  );
};
