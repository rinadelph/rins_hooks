const Utils = require('../src/utils');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

// Mock child_process
jest.mock('child_process');
jest.mock('fs-extra');

describe('Utils', () => {
  let utils;

  beforeEach(() => {
    utils = new Utils();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with platform and architecture', () => {
      expect(utils.platform).toBe(os.platform());
      expect(utils.arch).toBe(os.arch());
    });
  });

  describe('checkCommandAvailable', () => {
    it('should return true when command is available', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      const result = await utils.checkCommandAvailable('git');
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'where' : 'which',
        ['git'],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
    });

    it('should return false when command is not available', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error exit code
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      const result = await utils.checkCommandAvailable('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false when spawn throws error', async () => {
      const mockChild = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Command not found'));
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      const result = await utils.checkCommandAvailable('invalid');
      expect(result).toBe(false);
    });
  });

  describe('executeCommand', () => {
    it('should execute command successfully', async () => {
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
          callback('test output');
        }
      });

      spawn.mockReturnValue(mockChild);

      const result = await utils.executeCommand('echo', ['test']);
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });

    it('should handle command errors', async () => {
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
          callback('error output');
        }
      });

      spawn.mockReturnValue(mockChild);

      const result = await utils.executeCommand('false');
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
    });
  });

  describe('getClaudeSettingsDir', () => {
    it('should return correct settings directory path', () => {
      const expected = path.join(os.homedir(), '.claude');
      expect(utils.getClaudeSettingsDir()).toBe(expected);
    });
  });

  describe('normalizePath', () => {
    it('should normalize path for current platform', () => {
      const inputPath = '/test/path';
      const result = utils.normalizePath(inputPath);

      if (process.platform === 'win32') {
        expect(result).toBe('\\test\\path');
      } else {
        expect(result).toBe('/test/path');
      }
    });
  });

  describe('getExecutableExtension', () => {
    it('should return correct extension for platform', () => {
      const extension = utils.getExecutableExtension();
      
      if (process.platform === 'win32') {
        expect(extension).toBe('.exe');
      } else {
        expect(extension).toBe('');
      }
    });
  });

  describe('isDirectoryWritable', () => {
    it('should return true for writable directory', async () => {
      fs.access.mockResolvedValue();

      const result = await utils.isDirectoryWritable('/tmp');
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/tmp', fs.constants.W_OK);
    });

    it('should return false for non-writable directory', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await utils.isDirectoryWritable('/protected');
      expect(result).toBe(false);
    });
  });

  describe('createDirectory', () => {
    it('should create directory successfully', async () => {
      fs.ensureDir.mockResolvedValue();

      const result = await utils.createDirectory('/test/dir');
      expect(result).toBe(true);
      expect(fs.ensureDir).toHaveBeenCalledWith('/test/dir');
    });

    it('should handle directory creation errors', async () => {
      fs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      const result = await utils.createDirectory('/protected/dir');
      expect(result).toBe(false);
    });
  });

  describe('getSystemInfo', () => {
    it('should return system information', () => {
      const info = utils.getSystemInfo();
      
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('nodeVersion');
      expect(info).toHaveProperty('osRelease');
      expect(info).toHaveProperty('homedir');
      expect(info).toHaveProperty('cwd');
      
      expect(info.platform).toBe(os.platform());
      expect(info.arch).toBe(os.arch());
      expect(info.nodeVersion).toBe(process.version);
    });
  });

  describe('runDiagnostics', () => {
    it('should run comprehensive diagnostics', async () => {
      // Mock various checks
      utils.checkCommandAvailable = jest.fn()
        .mockResolvedValueOnce(true) // git
        .mockResolvedValueOnce(true); // jq
      
      utils.getClaudeCodePath = jest.fn().mockResolvedValue('/usr/bin/claude');
      utils.isGitRepository = jest.fn().mockResolvedValue(true);
      utils.getGitRepositoryRoot = jest.fn().mockResolvedValue('/repo');
      
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue({ hooks: {} });

      const diagnostics = await utils.runDiagnostics();
      
      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics.length).toBeGreaterThan(0);
      
      // Check that diagnostics contain expected checks
      const checkNames = diagnostics.map(d => d.check);
      expect(checkNames).toContain('Node.js Version');
      expect(checkNames).toContain('Git Installation');
    });
  });

  describe('getInstallationInstructions', () => {
    it('should return installation instructions for known tools', () => {
      const gitInstructions = utils.getInstallationInstructions('git');
      expect(gitInstructions).toBeTruthy();
      expect(typeof gitInstructions).toBe('string');
    });

    it('should return null for unknown tools', () => {
      const result = utils.getInstallationInstructions('unknown-tool');
      expect(result).toBeNull();
    });
  });
});