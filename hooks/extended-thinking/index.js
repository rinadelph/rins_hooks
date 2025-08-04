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
        return this.success();
      }

      const projectDir = input.cwd || null;
      const coordination = new HookCoordination(projectDir);
      const operationId = coordination.generateOperationId(input);
      
      // Check if this hook should run (prevent duplicates)
      if (!coordination.shouldRun('extended-thinking', input.hook_event_name, operationId)) {
        this.logActivity(input, `Skipping duplicate execution for ${input.hook_event_name}`);
        return this.success();
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
          result = this.success();
          break;
      }

      // Mark operation as complete
      coordination.markComplete('extended-thinking', input.hook_event_name, operationId);
      return result;

    } catch (error) {
      this.logActivity(input, `Error in extended thinking hook: ${error.message}`);
      return this.success(); // Fail gracefully
    }
  }

  /**
   * Handle UserPromptSubmit events - Deep thinking for all prompts
   */
  handleUserPromptSubmit(input, stateManager, toggles) {
    if (toggles.deepThinking) {
      const prompt = stateManager.getDeepThinkingPrompt();
      this.logActivity(input, 'Injecting deep thinking context for user prompt');

      const result = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: prompt
        }
      };

      console.log(JSON.stringify(result));
      process.exit(0);
    }

    return this.success();
  }

  /**
   * Handle PreToolUse events - Thinking before tool execution
   */
  handlePreToolUse(input, stateManager, toggles) {
    const toolName = input.tool_name;

    // Deep thinking: comprehensive analysis before any tool
    if (toggles.deepThinking) {
      const prompt = this.getPreToolDeepThinkingPrompt(toolName);
      this.logActivity(input, `Injecting deep thinking context before ${toolName}`);

      const result = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: prompt
        }
      };

      console.log(JSON.stringify(result));
      process.exit(0);
    }

    // Extended thinking: focused analysis for specific tools
    if (toggles.thinking && this.shouldApplyExtendedThinking(toolName)) {
      const prompt = this.getPreToolExtendedThinkingPrompt(toolName);
      this.logActivity(input, `Injecting extended thinking context before ${toolName}`);

      const result = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: prompt
        }
      };

      console.log(JSON.stringify(result));
      process.exit(0);
    }

    return this.success();
  }

  /**
   * Handle PostToolUse events - Thinking after tool execution
   */
  handlePostToolUse(input, stateManager, toggles) {
    if (toggles.deepThinking) {
      const toolName = input.tool_name;
      const prompt = this.getPostToolThinkingPrompt(toolName);
      this.logActivity(input, `Injecting post-tool thinking context after ${toolName}`);

      const result = {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: prompt
        }
      };

      console.log(JSON.stringify(result));
      process.exit(0);
    }

    return this.success();
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
    return `Before using the ${toolName} tool, engage in DEEP analytical thinking:

## 🧠 PRE-TOOL DEEP ANALYSIS

### 1. **Tool Context Understanding**
   - What is this ${toolName} tool about to do?
   - What are the potential implications of this action?
   - Are there any risks or considerations I should be aware of?

### 2. **Strategic Planning**
   - Is this the optimal approach for the current task?
   - What alternatives exist and why is this choice better?
   - How does this fit into the broader workflow?

### 3. **Preparation & Verification**
   - Do I have all the information needed to use this tool effectively?
   - Are there any prerequisites or setup steps I should consider?
   - What could go wrong and how can I mitigate risks?

Now proceed with using the ${toolName} tool with this comprehensive understanding.`;
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

    return `## 🧠 Extended Thinking: ${toolName} Tool

${specificPrompt}

Consider:
1. **Purpose**: What am I trying to accomplish?
2. **Approach**: Is this the best way to achieve the goal?
3. **Precision**: How can I be most accurate and efficient?
4. **Context**: How does this fit into the larger task?

Proceed thoughtfully with the ${toolName} operation.`;
  }

  /**
   * Get thinking prompt for after tool use
   */
  getPostToolThinkingPrompt(toolName) {
    return `After using the ${toolName} tool, engage in reflective analysis:

## 🧠 POST-TOOL REFLECTION

### 1. **Result Assessment**
   - Did the ${toolName} operation achieve the intended goal?
   - Are the results what I expected, and if not, why?
   - What insights can I gain from this outcome?

### 2. **Next Steps Planning**
   - What should I do next based on these results?
   - Are there follow-up actions needed?
   - How do these results inform my overall strategy?

### 3. **Learning Integration**
   - What did I learn from this ${toolName} operation?
   - How can I apply this knowledge to future similar tasks?
   - Are there patterns or principles I should remember?

Use this reflection to inform your next actions and responses.`;
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
      console.log(`🧠 Extended Thinking is now: ${newState ? '✅ ENABLED' : '❌ DISABLED'}`);
      const status = ExtendedThinkingHook.getStatus(projectDir);
      console.log('\n📊 Current Status:');
      console.log(`   Extended Thinking: ${status.thinking ? '✅ ON' : '❌ OFF'}`);
      console.log(`   Deep Thinking: ${status.deepThinking ? '✅ ON' : '❌ OFF'}`);
      console.log(`   Active Mode: ${status.activeMode}`);
    } else if (type === 'deepThinking') {
      const newState = ExtendedThinkingHook.toggleDeepThinking(projectDir);
      console.log(`🧠 Deep Thinking is now: ${newState ? '✅ ENABLED' : '❌ DISABLED'}`);
      const status = ExtendedThinkingHook.getStatus(projectDir);
      console.log('\n📊 Current Status:');
      console.log(`   Extended Thinking: ${status.thinking ? '✅ ON' : '❌ OFF'}`);
      console.log(`   Deep Thinking: ${status.deepThinking ? '✅ ON' : '❌ OFF'}`);
      console.log(`   Active Mode: ${status.activeMode}`);
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
