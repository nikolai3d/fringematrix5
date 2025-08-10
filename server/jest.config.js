/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
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


