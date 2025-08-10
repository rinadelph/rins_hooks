/**
 * Animated Git Component
 * Shows git status with animated indicators
 */

class AnimatedGitComponent {
  constructor(options = {}) {
    this.animationStyle = options.animationStyle || 'icon-rotation';
    this.speed = options.speed || 'medium';
    this.showStatus = options.showStatus !== false;
    this.enabled = options.enabled !== false;
  }

  /**
   * Generate animated git display
   */
  generate(branch, isDirty = false, frameNumber = 0) {
    if (!this.enabled) {
      const dirtyMarker = isDirty ? '*' : '';
      return `🌿${branch}${dirtyMarker}`;
    }

    switch (this.animationStyle) {
      case 'icon-rotation':
        return this.generateIconRotation(branch, isDirty, frameNumber);
      case 'status-pulse':
        return this.generateStatusPulse(branch, isDirty, frameNumber);
      case 'branch-glow':
        return this.generateBranchGlow(branch, isDirty, frameNumber);
      case 'activity-indicator':
        return this.generateActivityIndicator(branch, isDirty, frameNumber);
      default:
        const dirtyMarker = isDirty ? '*' : '';
        return `🌿${branch}${dirtyMarker}`;
    }
  }

  /**
   * Rotating git icons
   */
  generateIconRotation(branch, isDirty, frame) {
    const cleanIcons = ['🌿', '🌱', '🌲', '🌳'];
    const dirtyIcons = ['🔥', '⚡', '💥', '✨'];
    
    const icons = isDirty ? dirtyIcons : cleanIcons;
    const icon = icons[frame % icons.length];
    const dirtyMarker = isDirty ? '*' : '';
    
    return `\x1b[32m${icon}${branch}${dirtyMarker}\x1b[0m`;
  }

  /**
   * Pulsing status indicator
   */
  generateStatusPulse(branch, isDirty, frame) {
    if (isDirty) {
      const pulseStates = [
        '\x1b[31m',     // red
        '\x1b[1;31m',   // bright red
        '\x1b[91m',     // light red
        '\x1b[1;31m'    // bright red
      ];
      const colorCode = pulseStates[frame % pulseStates.length];
      return `\x1b[32m🌿${colorCode}${branch}*\x1b[0m`;
    } else {
      return `\x1b[32m🌿${branch}\x1b[0m`;
    }
  }

  /**
   * Glowing branch name
   */
  generateBranchGlow(branch, isDirty, frame) {
    const glowStates = [
      '\x1b[32m',      // normal green
      '\x1b[1;32m',    // bright green
      '\x1b[42;30m',   // green background
      '\x1b[1;32m'     // bright green
    ];
    
    const colorCode = glowStates[frame % glowStates.length];
    const dirtyMarker = isDirty ? '\x1b[31m*\x1b[0m' : '';
    
    return `🌿${colorCode}${branch}\x1b[0m${dirtyMarker}`;
  }

  /**
   * Activity indicator (dots for changes)
   */
  generateActivityIndicator(branch, isDirty, frame) {
    if (!isDirty) {
      return `\x1b[32m🌿${branch}\x1b[0m`;
    }

    const activityStates = ['', '.', '..', '...'];
    const dots = activityStates[frame % activityStates.length];
    
    return `\x1b[32m🌿${branch}\x1b[33m*${dots}\x1b[0m`;
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

module.exports = AnimatedGitComponent;