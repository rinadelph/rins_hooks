#!/usr/bin/env node

const StatusLineManager = require('./src/statusline/StatusLineManager');
const chalk = require('chalk');

console.log('🎨 Applying Subtle Animated Template...\n');

async function applyTemplate() {
  try {
    const manager = new StatusLineManager();
    
    // Find the subtle-animated template
    const template = manager.availableTemplates.find(t => t.name === 'subtle-animated');
    if (!template) {
      console.error('❌ Subtle animated template not found');
      process.exit(1);
    }
    
    console.log(`📋 Found template: ${chalk.cyan(template.displayName)}`);
    console.log(`📄 Description: ${template.description}`);
    console.log(`🎭 Preview: ${template.preview}\n`);
    
    // Create configuration
    const config = {
      type: 'command',
      command: template.script,
      padding: 0,
      template: template.name,
      components: template.components
    };
    
    // Apply to user settings (main Claude settings)
    await manager.saveConfig(config, 'user');
    
    console.log(chalk.green('✅ Subtle animated template applied to main Claude settings!'));
    console.log(chalk.yellow('⚠️  Please restart Claude Code to see the animated status line.'));
    console.log(chalk.cyan('💡 The status line will use these animated components:'));
    
    template.components.forEach(comp => {
      const component = manager.availableComponents.find(c => c.name === comp);
      if (component) {
        const animatedFlag = component.animated ? ' ✨' : '';
        console.log(`   ${component.icon || '📄'} ${component.displayName}${animatedFlag}`);
      }
    });
    
    console.log(chalk.dim('\n🔍 Settings saved to: ~/.claude/settings.json'));
    
  } catch (error) {
    console.error('❌ Error applying template:', error.message);
    process.exit(1);
  }
}

applyTemplate();