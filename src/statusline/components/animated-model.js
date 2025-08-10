/**
 * Animated Model Component
 * Shows the current Claude model with subtle animations
 */

class AnimatedModelComponent {
  constructor(options = {}) {
    this.animationStyle = options.animationStyle || 'pulse';
    this.speed = options.speed || 'medium';
    this.colors = options.colors || ['magenta', 'blue', 'cyan'];
    this.enabled = options.enabled !== false;
  }

  /**
   * Generate animated model display
   */
  generate(modelName, frameNumber = 0) {
    if (!this.enabled) {
      return `[${modelName}]`;
    }

    const shortName = this.getShortModelName(modelName);
    
    switch (this.animationStyle) {
      case 'pulse':
        return this.generatePulse(shortName, frameNumber);
      case 'color-cycle':
        return this.generateColorCycle(shortName, frameNumber);
      case 'glow':
        return this.generateGlow(shortName, frameNumber);
      case 'typewriter':
        return this.generateTypewriter(shortName, frameNumber);
      default:
        return `[${shortName}]`;
    }
  }

  /**
   * Pulsing animation (brightness changes)
   */
  generatePulse(modelName, frame) {
    const pulseStates = [
      '\033[2;35m', // dim magenta
      '\033[35m',   // normal magenta  
      '\033[1;35m', // bright magenta
      '\033[35m'    // normal magenta
    ];
    
    const colorCode = pulseStates[frame % pulseStates.length];
    return `${colorCode}[${modelName}]\033[0m`;
  }

  /**
   * Color cycling animation
   */
  generateColorCycle(modelName, frame) {
    const colorCodes = [
      '\033[35m', // magenta
      '\033[34m', // blue
      '\033[36m', // cyan
      '\033[32m'  // green
    ];
    
    const colorCode = colorCodes[frame % colorCodes.length];
    return `${colorCode}[${modelName}]\033[0m`;
  }

  /**
   * Glow effect animation
   */
  generateGlow(modelName, frame) {
    const glowStates = [
      '\033[35m[',     // normal brackets
      '\033[1;35m[',   // bright brackets
      '\033[1;45;35m[', // background glow
      '\033[1;35m['    // bright brackets
    ];
    
    const openBracket = glowStates[frame % glowStates.length];
    const closeBracket = openBracket.replace('[', ']');
    
    return `${openBracket}\033[1;37m${modelName}${closeBracket}\033[0m`;
  }

  /**
   * Typewriter animation (for model changes)
   */
  generateTypewriter(modelName, frame) {
    if (frame < modelName.length) {
      const partial = modelName.substring(0, frame + 1);
      const cursor = frame % 2 === 0 ? '_' : ' ';
      return `\033[35m[${partial}${cursor}]\033[0m`;
    }
    return `\033[35m[${modelName}]\033[0m`;
  }

  /**
   * Get shortened model name
   */
  getShortModelName(modelName) {
    const shortcuts = {
      'Claude Sonnet 4': 'S4',
      'Claude Sonnet': 'S4',
      'Sonnet 4': 'S4',
      'Claude Opus 4': 'O4',
      'Claude Opus': 'O4',
      'Opus 4': 'O4',
      'Claude Haiku 4': 'H4',
      'Claude Haiku': 'H4',
      'Haiku 4': 'H4'
    };

    return shortcuts[modelName] || modelName.substring(0, 3).toUpperCase();
  }

  /**
   * Get animation frame based on current time
   */
  getCurrentFrame() {
    const now = Date.now();
    const speeds = { slow: 1000, medium: 500, fast: 200 };
    const interval = speeds[this.speed] || 500;
    
    return Math.floor(now / interval);
  }
}

module.exports = AnimatedModelComponent;