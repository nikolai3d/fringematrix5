import { Config } from '@remotion/cli/config';

// Three.js needs a real GL backend in headless Chrome; the default renderer draws nothing.
Config.setChromiumOpenGlRenderer('angle');
