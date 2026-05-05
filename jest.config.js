module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/tests/**/*.test.js'],  // ← explicit rootDir prefix
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],        // ← explicitly exclude node_modules
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/models/**/*.js',
    'src/middleware/**/*.js',
    '!src/tests/**',
  ],
};