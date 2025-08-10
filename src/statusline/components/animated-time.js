/**
 * Animated Time Component
 * Shows current time with subtle animations
 */

class AnimatedTimeComponent {
  constructor(options = {}) {
    this.animationStyle = options.animationStyle || 'separator-blink';
    this.format = options.format || '24h'; // 24h or 12h
    this.showSeconds = options.showSeconds !== false;
    this.speed = options.speed || 'medium';
    this.enabled = options.enabled !== false;
  }

  /**
   * Generate animated time display
   */
  generate(frameNumber = 0) {
    const now = new Date();
    
    if (!this.enabled) {
      return this.getBasicTime(now);
    }

    switch (this.animationStyle) {
      case 'separator-blink':
        return this.generateSeparatorBlink(now, frameNumber);
      case 'color-transition':
        return this.generateColorTransition(now, frameNumber);
      case 'digital-clock':
        return this.generateDigitalClock(now, frameNumber);
      case 'smooth-update':
        return this.generateSmoothUpdate(now, frameNumber);
      default:
        return this.getBasicTime(now);
    }
  }

  /**
   * Blinking time separators
   */
  generateSeparatorBlink(now, frame) {
    const time = this.formatTime(now);
    const separator = frame % 2 === 0 ? ':' : '·';
    const animatedTime = time.replace(/:/g, separator);
    
    return `\033[33m${animatedTime}\033[0m`;
  }

  /**
   * Color transition based on time of day
   */
  generateColorTransition(now, frame) {
    const hour = now.getHours();
    const time = this.formatTime(now);
    
    // Color based on time of day
    let colorCode;
    if (hour >= 6 && hour < 12) {
      // Morning - yellow/orange cycle
      const colors = ['\033[33m', '\033[93m', '\033[31m', '\033[93m'];
      colorCode = colors[frame % colors.length];
    } else if (hour >= 12 && hour < 18) {
      // Afternoon - bright colors
      const colors = ['\033[33m', '\033[32m', '\033[36m', '\033[32m'];
      colorCode = colors[frame % colors.length];
    } else if (hour >= 18 && hour < 22) {
      // Evening - warm colors
      const colors = ['\033[33m', '\033[35m', '\033[31m', '\033[35m'];
      colorCode = colors[frame % colors.length];
    } else {
      // Night - cool colors
      const colors = ['\033[34m', '\033[36m', '\033[35m', '\033[36m'];
      colorCode = colors[frame % colors.length];
    }
    
    return `${colorCode}${time}\033[0m`;
  }

  /**
   * Digital clock effect with segments
   */
  generateDigitalClock(now, frame) {
    const time = this.formatTime(now);
    const glowStates = [
      '\033[33m',      // normal yellow
      '\033[1;33m',    // bright yellow
      '\033[43;30m',   // yellow background
      '\033[1;33m'     // bright yellow
    ];
    
    // Only glow every few seconds
    if (now.getSeconds() % 10 === 0) {
      const colorCode = glowStates[frame % glowStates.length];
      return `${colorCode}${time}\033[0m`;
    }
    
    return `\033[33m${time}\033[0m`;
  }

  /**
   * Smooth update animation (shows updating seconds)
   */
  generateSmoothUpdate(now, frame) {
    const baseTime = this.formatTime(now, false); // without seconds
    const seconds = now.getSeconds();
    
    if (this.showSeconds) {
      // Animate seconds appearance
      const secondsStr = seconds.toString().padStart(2, '0');
      const showDots = frame % 4;
      const dots = '.'.repeat(showDots);
      
      return `\033[33m${baseTime}:${secondsStr}${dots}\033[0m`;
    }
    
    return `\033[33m${baseTime}\033[0m`;
  }

  /**
   * Format time based on settings
   */
  formatTime(date, includeSeconds = true) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    let timeStr;
    if (this.format === '12h') {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      timeStr = `${hours}:${minutes}`;
      if (includeSeconds && this.showSeconds) {
        timeStr += `:${seconds}`;
      }
      timeStr += ` ${ampm}`;
    } else {
      const hoursStr = hours.toString().padStart(2, '0');
      timeStr = `${hoursStr}:${minutes}`;
      if (includeSeconds && this.showSeconds) {
        timeStr += `:${seconds}`;
      }
    }
    
    return timeStr;
  }

  /**
   * Get basic time without animation
   */
  getBasicTime(date) {
    return this.formatTime(date);
  }

  /**
   * Get current frame number
   */
  getCurrentFrame() {
    const now = Date.now();
    const speeds = { slow: 2000, medium: 1000, fast: 500 };
    const interval = speeds[this.speed] || 1000;
    
    return Math.floor(now / interval);
  }
}

module.exports = AnimatedTimeComponent;