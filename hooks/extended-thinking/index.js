#!/usr/bin/env node

const HookBase = require('../../src/hook-base');
const ThinkingStateManager = require('./state-manager');
const HookCoordination = require('./coordination');

class ExtendedThinkingHook extends HookBase {
  constructor() {
    super('extended-thinking', {
      description: 'Provides extended thinking capabilities with user control',
      matcher: '', // UserPromptSubmit doesn't use matchers
      timeout: 10 // Quick execution for prompt processing
    });
  }

  /**
     * Execute the hook for multiple event types
     * @param {Object} input - Hook input from Claude Code
     * @returns {Object} Hook result with optional additional context
     */
  execute(input) {
    try {
      if (!input || !input.hook_event_name) {
        return this.success({});
      }

      const projectDir = input.cwd || null;
      const coordination = new HookCoordination(projectDir);
      const operationId = coordination.generateOperationId(input);
      
      // Check if this hook should run (prevent duplicates)
      if (!coordination.shouldRun('extended-thinking', input.hook_event_name, operationId)) {
        this.logActivity(input, `Skipping duplicate execution for ${input.hook_event_name}`);
        return this.success({});
      }

      const stateManager = new ThinkingStateManager(projectDir);
      const toggles = stateManager.getToggles();

      // Clean up old locks
      coordination.cleanupOldLocks();

      // Handle different event types
      let result;
      switch (input.hook_event_name) {
        case 'UserPromptSubmit':
          result = this.handleUserPromptSubmit(input, stateManager, toggles, coordination, operationId);
          break;

        case 'PreToolUse':
          result = this.handlePreToolUse(input, stateManager, toggles, coordination, operationId);
          break;

        case 'PostToolUse':
          result = this.handlePostToolUse(input, stateManager, toggles, coordination, operationId);
          break;

        default:
          result = this.success({});
          break;
      }

      // Mark operation as complete
      coordination.markComplete('extended-thinking', input.hook_event_name, operationId);
      return result;

    } catch (error) {
      this.logActivity(input, `Error in extended thinking hook: ${error.message}`);
      return this.success({}); // Fail gracefully
    }
  }

  /**
   * Handle UserPromptSubmit events - Deep thinking for all prompts
   */
  handleUserPromptSubmit(input, stateManager, toggles, coordination, operationId) {
    if (toggles.deepThinking) {
      const prompt = stateManager.getDeepThinkingPrompt();
      this.logActivity(input, 'Injecting deep thinking context for user prompt');

      const resultData = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: prompt
        }
      };
      return this.success(resultData);
    }
    return this.success({});
  }

  /**
   * Handle PreToolUse events - Thinking before tool execution
   */
  handlePreToolUse(input, stateManager, toggles, coordination, operationId) {
    const toolName = input.tool_name;
    let resultData = null;

    // Deep thinking: comprehensive analysis before any tool
    if (toggles.deepThinking) {
      const prompt = this.getPreToolDeepThinkingPrompt(toolName);
      this.logActivity(input, `Injecting deep thinking context before ${toolName}`);

      resultData = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: prompt
        }
      };
    } else if (toggles.thinking && this.shouldApplyExtendedThinking(toolName)) {
      // Extended thinking: focused analysis for specific tools
      const prompt = this.getPreToolExtendedThinkingPrompt(toolName);
      this.logActivity(input, `Injecting extended thinking context before ${toolName}`);

      resultData = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: prompt
        }
      };
    }
    return this.success(resultData || {});
  }

  /**
   * Handle PostToolUse events - Thinking after tool execution
   */
  handlePostToolUse(input, stateManager, toggles, coordination, operationId) {
    if (toggles.deepThinking) {
      const toolName = input.tool_name;
      const prompt = this.getPostToolThinkingPrompt(toolName);
      this.logActivity(input, `Injecting post-tool thinking context after ${toolName}`);

      const resultData = {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: prompt
        }
      };
      return this.success(resultData);
    }
    return this.success({});
  }

  /**
   * Check if extended thinking should apply to this tool
   */
  shouldApplyExtendedThinking(toolName) {
    const extendedThinkingTools = [
      'Read', 'Edit', 'MultiEdit', 'Write',  // File operations
      'Bash',  // Command execution
      'Grep', 'Glob'  // Search operations
    ];

    return extendedThinkingTools.includes(toolName);
  }

  /**
   * Get deep thinking prompt for before tool use
   */
  getPreToolDeepThinkingPrompt(toolName) {
    return `Before using the ${toolName} tool, engage in DEEP analytical thinking:\n\n## 🧠 PRE-TOOL DEEP ANALYSIS\n\n### 1. **Tool Context Understanding**\n   - What is this ${toolName} tool about to do?\n   - What are the potential implications of this action?\n   - Are there any risks or considerations I should be aware of?\n\n### 2. **Strategic Planning**\n   - Is this the optimal approach for the current task?\n   - What alternatives exist and why is this choice better?\n   - How does this fit into the broader workflow?\n\n### 3. **Preparation & Verification**\n   - Do I have all the information needed to use this tool effectively?\n   - Are there any prerequisites or setup steps I should consider?\n   - What could go wrong and how can I mitigate risks?\n\nNow proceed with using the ${toolName} tool with this comprehensive understanding.`
  }

  /**
   * Get extended thinking prompt for before tool use
   */
  getPreToolExtendedThinkingPrompt(toolName) {
    const toolSpecificPrompts = {
      'Read': 'Before reading this file, think about what information I\'m looking for and how it relates to the current task.',
      'Edit': 'Before editing this file, think about the changes needed, potential impacts, and how to make precise modifications.',
      'Write': 'Before writing this file, think about the content structure, purpose, and how it fits into the project.',
      'Bash': 'Before executing this command, think about what it will do, potential side effects, and safety considerations.',
      'Grep': 'Before searching, think about the search strategy and what patterns will most effectively find the needed information.',
      'Glob': 'Before pattern matching, think about the file patterns that will capture exactly what I need.'
    };

    const specificPrompt = toolSpecificPrompts[toolName] || `Before using ${toolName}, think about the approach and expected outcomes.`;

    return `## 🧠 Extended Thinking: ${toolName} Tool\n\n${specificPrompt}\n\nConsider:\n1. **Purpose**: What am I trying to accomplish?\n2. **Approach**: Is this the best way to achieve the goal?\n3. **Precision**: How can I be most accurate and efficient?\n4. **Context**: How does this fit into the larger task?\n\nProceed thoughtfully with the ${toolName} operation.`
  }

  /**
   * Get thinking prompt for after tool use
   */
  getPostToolThinkingPrompt(toolName) {
    return `After using the ${toolName} tool, engage in reflective analysis:\n\n## 🧠 POST-TOOL REFLECTION\n\n### 1. **Result Assessment**\n   - Did the ${toolName} operation achieve the intended goal?\n   - Are the results what I expected, and if not, why?\n   - What insights can I gain from this outcome?\n\n### 2. **Next Steps Planning**\n   - What should I do next based on these results?\n   - Are there follow-up actions needed?\n   - How do these results inform my overall strategy?\n\n### 3. **Learning Integration**\n   - What did I learn from this ${toolName} operation?\n   - How can I apply this knowledge to future similar tasks?\n   - Are there patterns or principles I should remember?\n\nUse this reflection to inform your next actions and responses.`
  }

  /**
     * Log hook activity for debugging and monitoring
     * @param {Object} input - Hook input
     * @param {string} message - Log message
     */
  logActivity(input, message) {
    const timestamp = new Date().toISOString();

    // In debug mode or if logging is enabled, output to stderr for debugging
    if (process.env.CLAUDE_DEBUG || process.env.THINKING_HOOK_DEBUG) {
      console.error(`[${timestamp}] ExtendedThinking: ${message}`);
    }
  }

  /**
     * Get the thinking status for commands
     * @param {string} projectDir - Project directory
     * @returns {Object} Current thinking status
     */
  static getStatus(projectDir = null) {
    const stateManager = new ThinkingStateManager(projectDir);
    return stateManager.getStatus();
  }

  /**
     * Toggle thinking mode
     * @param {string} projectDir - Project directory
     * @returns {boolean} New thinking state
     */
  static toggleThinking(projectDir = null) {
    const stateManager = new ThinkingStateManager(projectDir);
    return stateManager.toggleThinking();
  }

  /**
     * Toggle deep thinking mode
     * @param {string} projectDir - Project directory
     * @returns {boolean} New deep thinking state
     */
  static toggleDeepThinking(projectDir = null) {
    const stateManager = new ThinkingStateManager(projectDir);
    return stateManager.toggleDeepThinking();
  }

  /**
     * Get thinking prompt for explicit use
     * @param {string} type - 'thinking' or 'deep'
     * @returns {string} Thinking prompt
     */
  static getThinkingPrompt(type = 'thinking') {
    const stateManager = new ThinkingStateManager();
    if (type === 'deep') {
      return stateManager.getDeepThinkingPrompt();
    } else {
      return stateManager.getExtendedThinkingPrompt();
    }
  }
}

// When run directly, handle both hook and command execution
if (require.main === module) {
  const args = process.argv.slice(2);

  // Check for command-line flags
  if (args.includes('--toggle')) {
    const type = args[args.indexOf('--toggle') + 1];
    const projectDir = process.cwd();

    if (type === 'thinking') {
      const newState = ExtendedThinkingHook.toggleThinking(projectDir);
      console.error(`🧠 Extended Thinking is now: ${newState ? '✅ ENABLED' : '❌ DISABLED'}`);
      const status = ExtendedThinkingHook.getStatus(projectDir);
      console.error('\n📊 Current Status:');
      console.error(`   Extended Thinking: ${status.thinking ? '✅ ON' : '❌ OFF'}`);
      console.error(`   Deep Thinking: ${status.deepThinking ? '✅ ON' : '❌ OFF'}`);
      console.error(`   Active Mode: ${status.activeMode}`);
    } else if (type === 'deepThinking') {
      const newState = ExtendedThinkingHook.toggleDeepThinking(projectDir);
      console.error(`🧠 Deep Thinking is now: ${newState ? '✅ ENABLED' : '❌ DISABLED'}`);
      const status = ExtendedThinkingHook.getStatus(projectDir);
      console.error('\n📊 Current Status:');
      console.error(`   Extended Thinking: ${status.thinking ? '✅ ON' : '❌ OFF'}`);
      console.error(`   Deep Thinking: ${status.deepThinking ? '✅ ON' : '❌ OFF'}`);
      console.error(`   Active Mode: ${status.activeMode}`);
    }
    process.exit(0);
  } else {
    // Normal hook execution
    HookBase.parseInput()
      .then(input => {
        const hook = new ExtendedThinkingHook();
        return hook.execute(input);
      })
      .then(result => {
        HookBase.outputResult(result);
      })
      .catch(error => {
        console.error(`Extended thinking hook error: ${error.message}`);
        process.exit(1);
      });
  }
}

module.exports = ExtendedThinkingHook;