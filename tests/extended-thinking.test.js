const ExtendedThinkingHook = require('../hooks/extended-thinking/index');
const ThinkingStateManager = require('../hooks/extended-thinking/state-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ExtendedThinkingHook', () => {
  let hook;
  let tempDir;
  let stateManager;

  beforeEach(() => {
    hook = new ExtendedThinkingHook();
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extended-thinking-test-'));
    stateManager = new ThinkingStateManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Constructor', () => {
    test('should initialize with correct name and config', () => {
      expect(hook.name).toBe('extended-thinking');
      expect(hook.config.description).toContain('extended thinking capabilities');
      expect(hook.config.timeout).toBe(10);
    });
  });

  describe('execute method', () => {
    test('should return success for non-UserPromptSubmit events', async () => {
      const input = {
        hook_event_name: 'PostToolUse',
        session_id: 'test123',
        cwd: tempDir
      };

      const result = await hook.execute(input);
      expect(result.success).toBe(true);
    });

    test('should return success when no thinking modes are enabled', async () => {
      // Ensure thinking modes are disabled
      stateManager.setToggle('thinking', false);
      stateManager.setToggle('deepThinking', false);

      const input = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'test123',
        prompt: 'Test prompt',
        cwd: tempDir
      };

      const result = await hook.execute(input);
      expect(result.success).toBe(true);
    });

    test('should inject extended thinking context when thinking mode is enabled', async () => {
      // Enable thinking mode
      stateManager.setToggle('thinking', true);
      stateManager.setToggle('deepThinking', false);

      const input = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'test123',
        prompt: 'Test prompt',
        cwd: tempDir
      };

      // Mock console.log to capture JSON output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await hook.execute(input);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('hookSpecificOutput')
      );
      expect(exitSpy).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('should inject deep thinking context when deep thinking mode is enabled', async () => {
      // Enable deep thinking mode (should take precedence)
      stateManager.setToggle('thinking', true);
      stateManager.setToggle('deepThinking', true);

      const input = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'test123',
        prompt: 'Test prompt',
        cwd: tempDir
      };

      // Mock console.log to capture JSON output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await hook.execute(input);

      const output = consoleSpy.mock.calls[0][0];
      const parsedOutput = JSON.parse(output);
      
      expect(parsedOutput.hookSpecificOutput.additionalContext).toContain('DEEP ANALYSIS MODE');
      expect(exitSpy).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('should handle errors gracefully', async () => {
      const input = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'test123',
        prompt: 'Test prompt',
        cwd: '/nonexistent/path' // This should cause an error
      };

      const result = await hook.execute(input);
      expect(result.success).toBe(true); // Should fail gracefully
    });
  });

  describe('static methods', () => {
    test('should get current status', () => {
      const status = ExtendedThinkingHook.getStatus(tempDir);
      expect(status).toHaveProperty('thinking');
      expect(status).toHaveProperty('deepThinking');
      expect(status).toHaveProperty('activeMode');
      expect(status).toHaveProperty('lastModified');
    });

    test('should toggle thinking mode', () => {
      const initialState = ExtendedThinkingHook.getStatus(tempDir).thinking;
      const newState = ExtendedThinkingHook.toggleThinking(tempDir);
      expect(newState).toBe(!initialState);
      
      const finalStatus = ExtendedThinkingHook.getStatus(tempDir);
      expect(finalStatus.thinking).toBe(newState);
    });

    test('should toggle deep thinking mode', () => {
      const initialState = ExtendedThinkingHook.getStatus(tempDir).deepThinking;
      const newState = ExtendedThinkingHook.toggleDeepThinking(tempDir);
      expect(newState).toBe(!initialState);
      
      const finalStatus = ExtendedThinkingHook.getStatus(tempDir);
      expect(finalStatus.deepThinking).toBe(newState);
    });

    test('should get thinking prompts', () => {
      const thinkingPrompt = ExtendedThinkingHook.getThinkingPrompt('thinking');
      const deepThinkingPrompt = ExtendedThinkingHook.getThinkingPrompt('deep');
      
      expect(thinkingPrompt).toContain('extended thinking');
      expect(deepThinkingPrompt).toContain('DEEP ANALYSIS MODE');
    });
  });
});

describe('ThinkingStateManager', () => {
  let stateManager;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-manager-test-'));
    stateManager = new ThinkingStateManager(tempDir);
  });

  afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('State management', () => {
    test('should initialize with default state', () => {
      const state = stateManager.readState();
      expect(state.thinkingToggle).toBe(false);
      expect(state.deepThinkingToggle).toBe(false);
      expect(state).toHaveProperty('lastModified');
    });

    test('should toggle thinking mode', () => {
      const initialState = stateManager.getToggles().thinking;
      const newState = stateManager.toggleThinking();
      expect(newState).toBe(!initialState);
      
      const currentToggles = stateManager.getToggles();
      expect(currentToggles.thinking).toBe(newState);
    });

    test('should toggle deep thinking mode', () => {
      const initialState = stateManager.getToggles().deepThinking;
      const newState = stateManager.toggleDeepThinking();
      expect(newState).toBe(!initialState);
      
      const currentToggles = stateManager.getToggles();
      expect(currentToggles.deepThinking).toBe(newState);
    });

    test('should set specific toggle values', () => {
      stateManager.setToggle('thinking', true);
      expect(stateManager.getToggles().thinking).toBe(true);
      
      stateManager.setToggle('deepThinking', true);
      expect(stateManager.getToggles().deepThinking).toBe(true);
      
      stateManager.setToggle('thinking', false);
      expect(stateManager.getToggles().thinking).toBe(false);
    });

    test('should throw error for invalid toggle type', () => {
      expect(() => {
        stateManager.setToggle('invalid', true);
      }).toThrow('Invalid toggle type: invalid');
    });

    test('should persist state to file', () => {
      stateManager.setToggle('thinking', true);
      
      // Create new instance to test persistence
      const newStateManager = new ThinkingStateManager(tempDir);
      const state = newStateManager.getToggles();
      expect(state.thinking).toBe(true);
    });
  });

  describe('Thinking prompts', () => {
    test('should return null when no thinking enabled', () => {
      stateManager.setToggle('thinking', false);
      stateManager.setToggle('deepThinking', false);
      
      const prompt = stateManager.getThinkingPrompt();
      expect(prompt).toBeNull();
    });

    test('should return extended thinking prompt when thinking enabled', () => {
      stateManager.setToggle('thinking', true);
      stateManager.setToggle('deepThinking', false);
      
      const prompt = stateManager.getThinkingPrompt();
      expect(prompt).toContain('extended thinking');
      expect(prompt).toContain('step-by-step');
    });

    test('should return deep thinking prompt when deep thinking enabled', () => {
      stateManager.setToggle('thinking', false);
      stateManager.setToggle('deepThinking', true);
      
      const prompt = stateManager.getThinkingPrompt();
      expect(prompt).toContain('DEEP ANALYSIS MODE');
      expect(prompt).toContain('systematically');
    });

    test('should prioritize deep thinking over regular thinking', () => {
      stateManager.setToggle('thinking', true);
      stateManager.setToggle('deepThinking', true);
      
      const prompt = stateManager.getThinkingPrompt();
      expect(prompt).toContain('DEEP ANALYSIS MODE');
    });
  });

  describe('Status information', () => {
    test('should provide comprehensive status', () => {
      stateManager.setToggle('thinking', true);
      const status = stateManager.getStatus();
      
      expect(status).toHaveProperty('thinking', true);
      expect(status).toHaveProperty('deepThinking', false);
      expect(status).toHaveProperty('lastModified');
      expect(status).toHaveProperty('stateFile');
      expect(status).toHaveProperty('activeMode');
      expect(status.activeMode).toBe('Extended Thinking');
    });

    test('should show correct active mode', () => {
      // Normal mode
      stateManager.setToggle('thinking', false);
      stateManager.setToggle('deepThinking', false);
      expect(stateManager.getStatus().activeMode).toBe('Normal');
      
      // Extended thinking mode
      stateManager.setToggle('thinking', true);
      expect(stateManager.getStatus().activeMode).toBe('Extended Thinking');
      
      // Deep thinking mode (takes precedence)
      stateManager.setToggle('deepThinking', true);
      expect(stateManager.getStatus().activeMode).toBe('Deep Thinking');
    });
  });

  describe('Error handling', () => {
    test('should handle read errors gracefully', () => {
      // Create state manager with invalid directory
      const invalidStateManager = new ThinkingStateManager('/nonexistent/path');
      const state = invalidStateManager.readState();
      
      // Should return default state
      expect(state.thinkingToggle).toBe(false);
      expect(state.deepThinkingToggle).toBe(false);
    });

    test('should handle corrupted state file', () => {
      // Write invalid JSON to state file
      const stateFile = path.join(tempDir, '.claude', 'extended-thinking-state.json');
      fs.ensureDirSync(path.dirname(stateFile));
      fs.writeFileSync(stateFile, 'invalid json');
      
      const state = stateManager.readState();
      expect(state.thinkingToggle).toBe(false); // Should return default
    });
  });
});