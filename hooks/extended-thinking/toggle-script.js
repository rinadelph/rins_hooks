#!/usr/bin/env node

const path = require('path');
const ThinkingStateManager = require('./state-manager');

function main() {
    const args = process.argv.slice(2);
    const toggleType = args[0]; // 'thinking' or 'deepThinking'
    const value = args[1]; // 'on', 'off', or undefined for toggle

    if (!toggleType || !['thinking', 'deepThinking'].includes(toggleType)) {
        console.error('Invalid toggle type. Use "thinking" or "deepThinking"');
        process.exit(1);
    }

    try {
        // Get project directory from environment variable set by Claude Code
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        const stateManager = new ThinkingStateManager(projectDir);

        let newState;
        const displayName = toggleType === 'thinking' ? 'Extended Thinking' : 'Deep Thinking';

        if (value === 'on') {
            stateManager.setToggle(toggleType, true);
            newState = true;
        } else if (value === 'off') {
            stateManager.setToggle(toggleType, false);
            newState = false;
        } else {
            // Toggle current state
            if (toggleType === 'thinking') {
                newState = stateManager.toggleThinking();
            } else {
                newState = stateManager.toggleDeepThinking();
            }
        }

        const status = stateManager.getStatus();
        
        // Output result
        console.log(`🧠 ${displayName} is now: ${newState ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log('');
        
        if (newState) {
            console.log(`All future prompts will automatically use ${displayName.toLowerCase()}.`);
            if (toggleType === 'deepThinking' && status.thinking) {
                console.log('Note: Deep thinking takes precedence over regular extended thinking.');
            }
        } else {
            console.log(`Future prompts will use normal processing (unless explicitly using /think or /deep-think commands).`);
        }

        console.log('');
        console.log('📊 Current Status:');
        console.log(`   Extended Thinking: ${status.thinking ? '✅ ON' : '❌ OFF'}`);
        console.log(`   Deep Thinking: ${status.deepThinking ? '✅ ON' : '❌ OFF'}`);
        console.log(`   Active Mode: ${status.activeMode}`);

    } catch (error) {
        console.error(`Error managing ${toggleType} toggle:`, error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}