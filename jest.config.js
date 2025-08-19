module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 15000, // Increased for child process tests
  maxWorkers: 1, // Ensure tests run sequentially for database safety
  // Uncomment these for debugging hanging tests:
  // forceExit: true, // Force Jest to exit if handles remain open
  // detectOpenHandles: true, // Show what's keeping Jest alive
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};
