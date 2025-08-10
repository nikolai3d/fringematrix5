/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  collectCoverage: true,
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov'],
};


