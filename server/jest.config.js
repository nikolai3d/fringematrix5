/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  // ts-jest with ESM uses Node's native ESM loader, which keeps the .js
  // extension in import specifiers (as TypeScript requires for ESM output).
  // Jest doesn't remap .js → .ts automatically, so we do it here.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: [],
  roots: ['<rootDir>/test'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/**/*.{js,ts}',
    '!<rootDir>/**/node_modules/**',
    '!<rootDir>/test/**',
    '!<rootDir>/coverage/**',
  ],
  coverageReporters: ['text', 'lcov'],
};


