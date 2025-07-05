const AutoCommitHook = require('../hooks/auto-commit/index');
const { spawn } = require('child_process');
const fs = require('fs');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');

describe('AutoCommitHook', () => {
  let hook;

  beforeEach(() => {
    hook = new AutoCommitHook();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with auto-commit configuration', () => {
      expect(hook.name).toBe('auto-commit');
      expect(hook.config.enabled).toBe(true);
      expect(hook.config.matcher).toBe('Edit|Write|MultiEdit');
      expect(hook.config.excludePatterns).toContain('*.log');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default auto-commit configuration', () => {
      const config = hook.getDefaultConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.matcher).toBe('Edit|Write|MultiEdit');
      expect(config.commitMessageTemplate).toContain('Auto-commit');
      expect(config.excludePatterns).toContain('*.log');
      expect(config.skipEmptyCommits).toBe(true);
    });
  });

  describe('shouldExcludeFile', () => {
    it('should exclude files matching patterns', () => {
      expect(hook.shouldExcludeFile('/path/to/test.log')).toBe(true);
      expect(hook.shouldExcludeFile('/path/to/test.env')).toBe(true);
      expect(hook.shouldExcludeFile('/path/to/node_modules/file.js')).toBe(true);
      expect(hook.shouldExcludeFile('/path/to/regular.js')).toBe(false);
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message from template', () => {
      const message = hook.generateCommitMessage('Write', '/path/to/test.js', 'session-123');
      
      expect(message).toContain('Auto-commit: Write modified test.js');
      expect(message).toContain('File: /path/to/test.js');
      expect(message).toContain('Tool: Write');
      expect(message).toContain('Session: session-123');
      expect(message).toContain('Generated with Claude Code');
    });

    it('should truncate long commit messages', () => {
      // Create a scenario that will definitely exceed the limit
      const veryLongSessionId = 'x'.repeat(600);
      const message = hook.generateCommitMessage('Write', '/test.js', veryLongSessionId);
      
      expect(message.length).toBeLessThanOrEqual(hook.config.maxCommitMessageLength);
      if (message.length === hook.config.maxCommitMessageLength) {
        expect(message).toMatch(/\.\.\.$/);
      }
    });
  });

  describe('isGitRepository', () => {
    it('should return true when in git repository', async () => {
      // Mock runGitCommand directly instead of spawn
      hook.runGitCommand = jest.fn().mockResolvedValue('success');

      const result = await hook.isGitRepository();
      expect(result).toBe(true);
      expect(hook.runGitCommand).toHaveBeenCalledWith(['rev-parse', '--git-dir']);
    });

    it('should return false when not in git repository', async () => {
      // Mock runGitCommand to throw error
      hook.runGitCommand = jest.fn().mockRejectedValue(new Error('Not a git repository'));

      const result = await hook.isGitRepository();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      hook.isGitRepository = jest.fn().mockResolvedValue(true);
      hook.shouldExcludeFile = jest.fn().mockReturnValue(false);
      hook.isBranchRestricted = jest.fn().mockResolvedValue(false);
      hook.hasChangesToCommit = jest.fn().mockResolvedValue(true);
      hook.runGitCommand = jest.fn().mockResolvedValue('success');
    });

    it('should successfully commit file changes', async () => {
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/test.js' },
        session_id: 'session-123'
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('Successfully committed test.js');
      expect(hook.runGitCommand).toHaveBeenCalledWith(['add', '/path/to/test.js']);
      expect(hook.runGitCommand).toHaveBeenCalledWith(
        expect.arrayContaining(['commit', '-m'])
      );
    });

    it('should skip commit when not in git repository', async () => {
      hook.isGitRepository.mockResolvedValue(false);
      
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/test.js' }
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('Not in a git repository');
    });

    it('should skip excluded files', async () => {
      hook.shouldExcludeFile.mockReturnValue(true);
      
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/test.log' }
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('File excluded from auto-commit');
    });

    it('should handle missing file path', async () => {
      const input = {
        tool_name: 'Write',
        tool_input: {}
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No file path found');
    });

    it('should handle non-existent files', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/missing.js' }
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File does not exist');
    });

    it('should skip when no changes to commit', async () => {
      hook.hasChangesToCommit.mockResolvedValue(false);
      
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/test.js' }
      };

      const result = await hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('No changes to commit');
    });
  });

  describe('runGitCommand', () => {
    it('should execute git commands successfully', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };

      mockChild.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('git output');
        }
      });

      spawn.mockReturnValue(mockChild);

      const result = await hook.runGitCommand(['status']);
      expect(result).toContain('git output');
    });

    it('should handle git command failures', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        })
      };

      mockChild.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('git error');
        }
      });

      spawn.mockReturnValue(mockChild);

      await expect(hook.runGitCommand(['invalid'])).rejects.toThrow('Git command failed');
    });
  });
});