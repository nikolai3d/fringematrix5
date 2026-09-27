import { AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { ArtWall, Intro, Origin, Outro, Product, Stats, Timeline } from './scenes';

const SCENES = [
  { C: Intro, d: 110 },
  { C: Origin, d: 170 },
  { C: ArtWall, d: 180 },
  { C: Stats, d: 170 },
  { C: Timeline, d: 190 },
  { C: Product, d: 220 },
  { C: Outro, d: 160 },
];
const T = 15;
const TRANSITIONS: TransitionPresentation<any>[] = [fade(), fade(), slide({ direction: 'from-bottom' }), wipe({ direction: 'from-left' }), fade(), fade()];

export const PROMO_DURATION = SCENES.reduce((n, s) => n + s.d, 0) - T * (SCENES.length - 1);

export const Promo: React.FC = () => {
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
      <Audio
        src={staticFile('soundtrack.wav')}
        volume={(f) => interpolate(f, [0, 20, durationInFrames - 40, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateRight: 'clamp' })}
      />
    </AbsoluteFill>
  );
};
