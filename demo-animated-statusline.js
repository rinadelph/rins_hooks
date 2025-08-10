#!/usr/bin/env node

const chalk = require('chalk');
const StatusLineManager = require('./src/statusline/StatusLineManager');

async function demo() {
  console.clear();
  console.log(chalk.bold.cyan('🎬 Animated Status Line Components Demo\n'));

  const manager = new StatusLineManager();
  
  console.log(chalk.yellow('📋 Available Animated Templates:'));
  const templates = manager.availableTemplates;
  
  templates.forEach(template => {
    if (template.name.includes('animate') || template.name.includes('compact')) {
      console.log(`  ${chalk.cyan('•')} ${chalk.bold(template.displayName)} - ${template.description}`);
      console.log(`    ${chalk.gray('Preview:')} ${template.preview}`);
    }
  });

  console.log('\n' + chalk.yellow('🧩 Animation Features:'));
  console.log(`  ${chalk.cyan('•')} ${chalk.bold('Model Animations')}: Pulsing, color cycling, glow effects`);
  console.log(`  ${chalk.cyan('•')} ${chalk.bold('Directory Animations')}: Icon pulsing, folder open/close, scrolling text`);
  console.log(`  ${chalk.cyan('•')} ${chalk.bold('Git Animations')}: Icon rotation, status pulsing, activity dots`);
  console.log(`  ${chalk.cyan('•')} ${chalk.bold('Time Animations')}: Separator blinking, color transitions, digital glow`);

  console.log('\n' + chalk.yellow('⚙️  How to Apply:'));
  console.log(`  1. Run: ${chalk.green('rapala')}`);
  console.log(`  2. Navigate to: ${chalk.cyan('Status Line')}`);
  console.log(`  3. Choose: ${chalk.magenta('Template Gallery')}`);
  console.log(`  4. Select: ${chalk.blue('Animated')} or ${chalk.blue('Advanced Animated')}`);
  console.log(`  5. Restart Claude Code to see animations`);

  console.log('\n' + chalk.yellow('💡 Animation Examples:'));
  
  // Show different animation frames
  const AnimatedModelComponent = require('./src/statusline/components/animated-model');
  const modelComp = new AnimatedModelComponent({ animationStyle: 'pulse' });
  
  console.log('\n  Model Pulse Animation:');
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      process.stdout.write(`\r    Frame ${i}: ${modelComp.generate('Claude Sonnet 4', i)}   `);
      if (i === 3) {
        console.log('\n');
        console.log(chalk.green('🎯 Status line animations are ready to use!'));
        console.log(chalk.gray('Components provide smooth, subtle visual feedback without distraction.'));
      }
    }, i * 500);
  }
}

demo().catch(console.error);