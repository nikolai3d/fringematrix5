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


