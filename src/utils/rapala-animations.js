/**
 * Rapala UI Animations
 * Provides animated elements for the Rapala control panel
 */

const chalk = require('chalk');

class RapalaAnimations {
  constructor() {
    this.isAnimating = false;
  }

  /**
   * Animated loading text
   */
  async showLoading(text, duration = 3000) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    const startTime = Date.now();
    
    this.isAnimating = true;
    
    while (this.isAnimating && (Date.now() - startTime) < duration) {
      const spinner = chalk.cyan(frames[frameIndex]);
      process.stdout.write(`\r${spinner} ${chalk.yellow(text)}...`);
      frameIndex = (frameIndex + 1) % frames.length;
      await this.sleep(100);
    }
    
    if (!this.isAnimating) {
      process.stdout.write(`\r${chalk.green('✓')} ${chalk.white(text)} complete!\n`);
    }
  }

  /**
   * Animated progress bar
   */
  async showProgress(text, steps = 20) {
    console.log(chalk.cyan(`\n📊 ${text}`));
    console.log(chalk.gray('━'.repeat(50)));
    
    for (let i = 0; i <= steps; i++) {
      const percentage = Math.round((i / steps) * 100);
      const filled = Math.round((percentage / 100) * 30);
      const empty = 30 - filled;
      
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const color = percentage < 50 ? chalk.red : percentage < 80 ? chalk.yellow : chalk.green;
      
      process.stdout.write(`\r${color(bar)} ${percentage}%`);
      await this.sleep(100);
    }
    
    console.log(chalk.green('\n✅ Complete!'));
  }

  /**
   * Sliding banner animation
   */
  async showBanner(text, width = 60) {
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
    const fullText = `🚀 ${text} 🚀   `;
    
    // Slide in from right
    for (let i = 0; i <= width + fullText.length; i++) {
      const spaces = ' '.repeat(Math.max(0, width - i));
      const visibleText = fullText.substring(Math.max(0, fullText.length - i), fullText.length);
      const colorIndex = Math.floor(i / 5) % colors.length;
      
      process.stdout.write(`\r${spaces}${colors[colorIndex](visibleText)}`);
      await this.sleep(50);
    }
    
    console.log('\n');
  }

  /**
   * Matrix-style text reveal
   */
  async revealText(text, options = {}) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*';
    const iterations = options.iterations || 10;
    const speed = options.speed || 50;
    
    let revealed = '';
    
    for (let i = 0; i < text.length; i++) {
      for (let j = 0; j < iterations; j++) {
        const randomChar = chars[Math.floor(Math.random() * chars.length)];
        const display = revealed + chalk.green(randomChar) + chalk.dim(text.substring(i + 1));
        
        process.stdout.write(`\r${display}`);
        await this.sleep(speed);
      }
      revealed += text[i];
    }
    
    process.stdout.write(`\r${chalk.cyan(text)}\n`);
  }

  /**
   * Typewriter with sound effect simulation
   */
  async typewriter(text, options = {}) {
    const speed = options.speed || 80;
    const color = options.color || chalk.green;
    
    for (let i = 0; i <= text.length; i++) {
      process.stdout.write(`\r${color(text.substring(0, i))}`);
      
      // Simulate typing sounds with different delays
      const char = text[i - 1];
      if (char === ' ') {
        await this.sleep(speed * 0.5); // Shorter delay for spaces
      } else if (char === '.' || char === '!' || char === '?') {
        await this.sleep(speed * 2); // Longer delay for punctuation
      } else {
        await this.sleep(speed);
      }
    }
    
    console.log('');
  }

  /**
   * Pulsing text effect
   */
  async pulseText(text, pulses = 3) {
    const colors = [chalk.dim, chalk.white, chalk.bold.white, chalk.white];
    
    for (let pulse = 0; pulse < pulses; pulse++) {
      for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
        process.stdout.write(`\r${colors[colorIndex](text)}`);
        await this.sleep(200);
      }
      // Reverse animation
      for (let colorIndex = colors.length - 2; colorIndex >= 0; colorIndex--) {
        process.stdout.write(`\r${colors[colorIndex](text)}`);
        await this.sleep(200);
      }
    }
    
    console.log('');
  }

  /**
   * Menu transition animation
   */
  async transitionMenu(fromTitle, toTitle) {
    // Fade out current menu
    const fadeSteps = 5;
    for (let i = fadeSteps; i >= 0; i--) {
      const opacity = i / fadeSteps;
      const color = opacity > 0.5 ? chalk.white : chalk.gray;
      process.stdout.write(`\r${color(fromTitle + ' '.repeat(20))}`);
      await this.sleep(100);
    }
    
    // Slide in new menu
    await this.slideText(toTitle, { color: chalk.bold.cyan });
  }

  /**
   * Slide text animation (reused from TextAnimator)
   */
  async slideText(text, options = {}) {
    const width = options.width || 60;
    const speed = options.speed || 80;
    const color = options.color || chalk.white;
    
    for (let i = 0; i <= width; i++) {
      const spaces = ' '.repeat(Math.max(0, width - i - text.length));
      const visibleText = text.substring(Math.max(0, text.length - i), text.length);
      
      process.stdout.write(`\r${spaces}${color(visibleText)}`);
      await this.sleep(speed);
    }
    
    console.log('');
  }

  /**
   * Stop any running animation
   */
  stop() {
    this.isAnimating = false;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RapalaAnimations;