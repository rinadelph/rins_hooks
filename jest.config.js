module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    'hooks/**/*.js',
    '!src/**/*.test.js',
    '!hooks/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  verbose: true,
  collectCoverage: false, // Set to true to collect coverage by default
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 25,
      lines: 18,
      statements: 18
    }
  }
};