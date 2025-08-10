#!/usr/bin/env node

/**
 * Text Animation System
 * Creates various left-to-right text animations for terminal interfaces
 */

class TextAnimator {
  constructor(options = {}) {
    this.width = options.width || process.stdout.columns || 80;
    this.speed = options.speed || 100; // milliseconds
    this.loop = options.loop !== false;
    this.colors = options.colors || false;
    this.running = false;
  }

  /**
   * Sliding text animation - text enters from right
   */
  async slideText(text, options = {}) {
    const width = options.width || this.width;
    const speed = options.speed || this.speed;
    const color = options.color || '\x1b[37m'; // white
    const reset = '\x1b[0m';
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    for (let i = 0; i <= width; i++) {
      const spaces = ' '.repeat(Math.max(0, width - i - text.length));
      const visibleText = text.substring(Math.max(0, text.length - i), text.length);
      
      // Clear line and position cursor
      process.stdout.write('\r\x1b[K');
      process.stdout.write(color + spaces + visibleText + reset);
      
      await this.sleep(speed);
    }
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }

  /**
   * Scrolling marquee animation - text moves continuously
   */
  async marqueeText(text, options = {}) {
    const width = options.width || this.width;
    const speed = options.speed || this.speed;
    const color = options.color || '\x1b[36m'; // cyan
    const reset = '\x1b[0m';
    const padding = '   '; // Space between loops
    
    const fullText = text + padding;
    this.running = true;
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    let position = 0;
    while (this.running) {
      let displayText = '';
      
      // Build the visible text by repeating the full text as needed
      for (let i = 0; i < width; i++) {
        const charIndex = (position + i) % fullText.length;
        displayText += fullText[charIndex];
      }
      
      // Display the text
      process.stdout.write('\r\x1b[K');
      process.stdout.write(color + displayText.substring(0, width) + reset);
      
      position = (position + 1) % fullText.length;
      await this.sleep(speed);
    }
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }

  /**
   * Typewriter effect - characters appear one by one from left
   */
  async typewriterText(text, options = {}) {
    const speed = options.speed || this.speed;
    const color = options.color || '\x1b[32m'; // green
    const reset = '\x1b[0m';
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    process.stdout.write(color);
    for (let i = 0; i <= text.length; i++) {
      process.stdout.write('\r\x1b[K');
      process.stdout.write(text.substring(0, i));
      await this.sleep(speed);
    }
    process.stdout.write(reset);
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }

  /**
   * Wave effect - text appears with color wave
   */
  async waveText(text, options = {}) {
    const speed = options.speed || this.speed;
    const colors = options.colors || ['\x1b[31m', '\x1b[33m', '\x1b[32m', '\x1b[36m', '\x1b[35m'];
    const reset = '\x1b[0m';
    const waves = options.waves || 3;
    
    // Hide cursor
    process.stdout.write('\x1b[?25l');
    
    for (let wave = 0; wave < waves; wave++) {
      for (let pos = 0; pos < text.length + colors.length; pos++) {
        process.stdout.write('\r\x1b[K');
        
        for (let i = 0; i < text.length; i++) {
          const colorIndex = (pos - i + colors.length) % colors.length;
          if (pos >= i && pos < i + colors.length) {
            process.stdout.write(colors[colorIndex] + text[i] + reset);
          } else {
            process.stdout.write(text[i]);
          }
        }
        
        await this.sleep(speed);
      }
    }
    
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }

  /**
   * Status line animation - for use in status bars
   */
  generateAnimatedStatusLine(baseText, animationText, frame) {
    const maxWidth = 20; // Compact status line space
    const fullText = animationText + '   ';
    const position = frame % fullText.length;
    
    let animated = '';
    for (let i = 0; i < maxWidth; i++) {
      const charIndex = (position + i) % fullText.length;
      animated += fullText[charIndex];
    }
    
    return baseText.replace('{animation}', animated.substring(0, maxWidth));
  }

  /**
   * Stop running animations
   */
  stop() {
    this.running = false;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const text = args[0] || 'Hello Rapala! 🚀';
  const type = args[1] || 'slide';
  
  const animator = new TextAnimator({
    width: 60,
    speed: 80
  });
  
  console.log('Text Animation Demo - Press Ctrl+C to exit\n');
  
  async function runDemo() {
    try {
      switch (type) {
        case 'slide':
          await animator.slideText(text, { color: '\x1b[35m' }); // magenta
          break;
        case 'marquee':
          await animator.marqueeText(text);
          break;
        case 'typewriter':
          await animator.typewriterText(text);
          break;
        case 'wave':
          await animator.waveText(text);
          break;
        default:
          console.log('Available animations: slide, marquee, typewriter, wave');
      }
      console.log('\n');
    } catch (error) {
      console.log('\nAnimation stopped');
    }
  }
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    animator.stop();
    process.stdout.write('\n\x1b[?25h'); // Show cursor and newline
    process.exit(0);
  });
  
  runDemo();
}

module.exports = TextAnimator;