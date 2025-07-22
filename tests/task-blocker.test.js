const TaskBlockerHook = require('../hooks/task-blocker');

describe('TaskBlockerHook', () => {
  let hook;

  beforeEach(() => {
    hook = new TaskBlockerHook();
  });

  describe('constructor', () => {
    it('should initialize with task-blocker configuration', () => {
      expect(hook.name).toBe('task-blocker');
      expect(hook.config).toBeDefined();
      expect(hook.config.enabled).toBe(true);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default task-blocker configuration', () => {
      const config = hook.getDefaultConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.matcher).toBe('');
      expect(config.timeout).toBe(5);
      expect(config.description).toBe('Configures Claude Code to block Task tool usage via permissions');
      expect(config.blockMessage).toBe('Task tool usage is blocked. Please work directly without creating subagents.');
      expect(config.logActivity).toBe(true);
      expect(config.usePermissions).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute successfully with hook input', () => {
      const input = {
        hook_event_name: 'Notification',
        tool_name: 'Task',
        session_id: 'test-session'
      };

      const result = hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Task blocker hook executed - blocking handled by permissions');
      expect(result.data.usePermissions).toBe(true);
      expect(result.hook).toBe('task-blocker');
    });

    it('should handle missing input gracefully', () => {
      const input = {};

      const result = hook.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Task blocker hook executed - blocking handled by permissions');
    });

    it('should handle execution errors', () => {
      // Mock logActivity to throw an error
      const originalLogActivity = hook.logActivity;
      hook.logActivity = () => {
        throw new Error('Test error');
      };

      const input = {
        hook_event_name: 'Notification',
        tool_name: 'Task',
        session_id: 'test-session'
      };

      const result = hook.execute(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task blocker failed: Test error');
      expect(result.hook).toBe('task-blocker');

      // Restore original method
      hook.logActivity = originalLogActivity;
    });
  });

  describe('logActivity', () => {
    it('should log activity when enabled', () => {
      // Test that logActivity doesn't throw with valid input
      expect(() => {
        hook.logActivity('TEST_MESSAGE', { test: 'data' });
      }).not.toThrow();
    });

    it('should skip logging when disabled', () => {
      hook.config.logActivity = false;
      
      expect(() => {
        hook.logActivity('TEST_MESSAGE', { test: 'data' });
      }).not.toThrow();
    });
  });
});