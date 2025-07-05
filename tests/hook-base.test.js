const HookBase = require('../src/hook-base');
const fs = require('fs-extra');
const path = require('path');

describe('HookBase', () => {
  let hook;
  
  beforeEach(() => {
    hook = new HookBase('test-hook', {
      enabled: true,
      matcher: 'Edit|Write',
      timeout: 30
    });
  });

  describe('constructor', () => {
    it('should initialize with name and config', () => {
      expect(hook.name).toBe('test-hook');
      expect(hook.config.enabled).toBe(true);
      expect(hook.config.matcher).toBe('Edit|Write');
      expect(hook.config.timeout).toBe(30);
    });

    it('should merge with default config', () => {
      const hookWithDefaults = new HookBase('test-hook');
      expect(hookWithDefaults.config.enabled).toBe(true);
      expect(hookWithDefaults.config.timeout).toBe(60);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const defaultConfig = hook.getDefaultConfig();
      expect(defaultConfig).toHaveProperty('enabled', true);
      expect(defaultConfig).toHaveProperty('matcher', '');
      expect(defaultConfig).toHaveProperty('timeout', 60);
      expect(defaultConfig).toHaveProperty('description');
    });
  });

  describe('execute', () => {
    it('should throw error when not implemented', () => {
      expect(() => hook.execute({})).toThrow('execute() method must be implemented by subclass');
    });
  });

  describe('result methods', () => {
    it('should return success result', () => {
      const result = hook.success({ test: 'data' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: 'data' });
      expect(result.hook).toBe('test-hook');
    });

    it('should return error result', () => {
      const result = hook.error('Test error', { error: 'data' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.data).toEqual({ error: 'data' });
      expect(result.hook).toBe('test-hook');
    });

    it('should return block result', () => {
      const result = hook.block('Blocked for testing');
      expect(result.decision).toBe('block');
      expect(result.reason).toBe('Blocked for testing');
      expect(result.hook).toBe('test-hook');
    });

    it('should return approve result', () => {
      const result = hook.approve('Approved for testing');
      expect(result.decision).toBe('approve');
      expect(result.reason).toBe('Approved for testing');
      expect(result.hook).toBe('test-hook');
    });
  });

  describe('generateHookConfig', () => {
    it('should generate Claude Code hook configuration', () => {
      const config = hook.generateHookConfig('PostToolUse');
      expect(config).toHaveProperty('matcher', 'Edit|Write');
      expect(config).toHaveProperty('hooks');
      expect(config.hooks).toHaveLength(1);
      expect(config.hooks[0]).toHaveProperty('type', 'command');
      expect(config.hooks[0]).toHaveProperty('timeout', 30);
    });

    it('should use default event type if not specified', () => {
      const config = hook.generateHookConfig();
      expect(config.hooks[0].command).toContain('index.js');
    });
  });

  describe('validate', () => {
    it('should validate hook directory structure', async () => {
      // Mock fs.pathExists to simulate missing directory
      jest.spyOn(fs, 'pathExists').mockResolvedValue(false);
      
      const isValid = await hook.validate();
      expect(isValid).toBe(false);
      
      fs.pathExists.mockRestore();
    });
  });

  describe('getMetadata', () => {
    it('should return hook metadata', async () => {
      // Mock fs.readJson to return config
      jest.spyOn(fs, 'readJson').mockResolvedValue({
        description: 'Test hook',
        version: '1.0.0',
        tags: ['test'],
        platforms: ['linux']
      });
      
      const metadata = await hook.getMetadata();
      expect(metadata.name).toBe('test-hook');
      expect(metadata.description).toBe('Test hook');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.tags).toEqual(['test']);
      expect(metadata.platforms).toEqual(['linux']);
      
      fs.readJson.mockRestore();
    });

    it('should return default metadata on error', async () => {
      // Mock fs.readJson to throw error
      jest.spyOn(fs, 'readJson').mockRejectedValue(new Error('File not found'));
      
      const metadata = await hook.getMetadata();
      expect(metadata.name).toBe('test-hook');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.tags).toEqual([]);
      
      fs.readJson.mockRestore();
    });
  });

  describe('parseInput', () => {
    const originalStdin = process.stdin;
    
    afterEach(() => {
      process.stdin = originalStdin;
    });
    
    it('should be a static method that returns a Promise', () => {
      expect(typeof HookBase.parseInput).toBe('function');
      
      // Mock stdin to prevent the method from hanging
      process.stdin = {
        on: jest.fn()
      };
      
      const result = HookBase.parseInput();
      expect(result instanceof Promise).toBe(true);
      
      // Clean up by rejecting the promise
      result.catch(() => {});
    });
  });

  describe('outputResult', () => {
    const originalExit = process.exit;
    
    beforeEach(() => {
      process.exit = jest.fn();
    });
    
    afterEach(() => {
      process.exit = originalExit;
    });

    it('should output success result and exit with 0', () => {
      const result = { success: true, data: { test: 'data' } };
      
      HookBase.outputResult(result);
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should output error result and exit with 1', () => {
      const result = { success: false, error: 'Test error' };
      
      HookBase.outputResult(result);
      
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should output block result and exit with 2', () => {
      const result = { decision: 'block', reason: 'Blocked' };
      
      HookBase.outputResult(result);
      
      expect(process.exit).toHaveBeenCalledWith(2);
    });

    it('should output approve result and exit with 0', () => {
      const result = { decision: 'approve', reason: 'Approved' };
      
      HookBase.outputResult(result);
      
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});