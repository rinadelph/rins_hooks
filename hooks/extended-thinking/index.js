#!/usr/bin/env node

const HookBase = require('../../src/hook-base');
const ThinkingStateManager = require('./state-manager');

class ExtendedThinkingHook extends HookBase {
    constructor() {
        super('extended-thinking', {
            description: 'Provides extended thinking capabilities with user control',
            matcher: '', // UserPromptSubmit doesn't use matchers
            timeout: 10 // Quick execution for prompt processing
        });
    }

    /**
     * Execute the hook for UserPromptSubmit events
     * @param {Object} input - Hook input from Claude Code
     * @returns {Object} Hook result with optional additional context
     */
    async execute(input) {
        try {
            // Validate input
            if (!input || input.hook_event_name !== 'UserPromptSubmit') {
                return this.success();
            }

            // Get project directory from input if available
            const projectDir = input.cwd || null;
            const stateManager = new ThinkingStateManager(projectDir);

            // Check if any thinking mode is enabled
            const thinkingPrompt = stateManager.getThinkingPrompt();
            
            if (thinkingPrompt) {
                // Log activity for debugging
                this.logActivity(input, `Injecting thinking context (${stateManager.getStatus().activeMode})`);

                // Return JSON output with additional context
                const result = {
                    hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: thinkingPrompt
                    }
                };

                console.log(JSON.stringify(result));
                process.exit(0);
            } else {
                // No thinking mode enabled, let normal processing continue
                this.logActivity(input, 'No thinking mode enabled, continuing normally');
                return this.success();
            }

        } catch (error) {
            // Log error but don't block the user's prompt
            this.logActivity(input, `Error in extended thinking hook: ${error.message}`);
            return this.success(); // Fail gracefully
        }
    }

    /**
     * Log hook activity for debugging and monitoring
     * @param {Object} input - Hook input
     * @param {string} message - Log message
     */
    logActivity(input, message) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            hook: this.name,
            event: input.hook_event_name,
            session_id: input.session_id?.substring(0, 8) || 'unknown',
            message
        };

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

// When run directly (as a hook), parse input and execute
if (require.main === module) {
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

module.exports = ExtendedThinkingHook;