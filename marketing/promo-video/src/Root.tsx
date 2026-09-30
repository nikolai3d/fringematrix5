import { Composition } from 'remotion';
import { Promo, PROMO_DURATION } from './Promo';
import { WirePromo, WIRE_DURATION } from './wire/WirePromo';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FringePromo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="FringePromo3D" component={WirePromo} durationInFrames={WIRE_DURATION} fps={30} width={1920} height={1080} />
  </>
);
