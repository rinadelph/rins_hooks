// Jest setup file for rins_hooks tests

// Mock console methods to reduce noise in tests
const originalConsole = global.console;

// Store original methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Mock console methods during tests
beforeEach(() => {
  // Restore console for test debugging if needed
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
});

afterEach(() => {
  // Restore original console after each test
  global.console = originalConsole;
});

// Global test utilities
global.testUtils = {
  // Restore console for debugging
  restoreConsole: () => {
    global.console = originalConsole;
  },
  
  // Mock file system operations
  mockFS: () => {
    jest.mock('fs-extra');
  },
  
  // Mock child process operations
  mockChildProcess: () => {
    jest.mock('child_process');
  },
  
  // Create mock input for hooks
  createHookInput: (overrides = {}) => {
    return {
      session_id: 'test-session-123',
      transcript_path: '/tmp/test-transcript.jsonl',
      tool_name: 'Write',
      tool_input: {
        file_path: '/tmp/test-file.js',
        content: 'console.log("test");'
      },
      tool_response: {
        success: true,
        filePath: '/tmp/test-file.js'
      },
      ...overrides
    };
  },
  
  // Create mock Claude Code settings
  createMockSettings: (overrides = {}) => {
    return {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [
              {
                type: 'command',
                command: 'node /path/to/hook.js',
                timeout: 30
              }
            ]
          }
        ]
      },
      ...overrides
    };
  }
};

// Set up global mocks
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Set longer timeout for integration tests
jest.setTimeout(10000);