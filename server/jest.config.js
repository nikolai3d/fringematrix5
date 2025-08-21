/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: [],
  roots: ['<rootDir>/test'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/**/*.js',
    '!<rootDir>/**/node_modules/**',
    '!<rootDir>/test/**',
  ],
  coverageReporters: ['text', 'lcov'],
};


