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
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};