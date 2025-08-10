/**
 * Animated Directory Component  
 * Shows current directory with subtle animations
 */

class AnimatedDirectoryComponent {
  constructor(options = {}) {
    this.animationStyle = options.animationStyle || 'icon-pulse';
    this.showFull = options.showFull || false;
    this.maxLength = options.maxLength || 20;
    this.speed = options.speed || 'slow';
    this.enabled = options.enabled !== false;
  }

  /**
   * Generate animated directory display
   */
  generate(fullPath, frameNumber = 0) {
    if (!this.enabled) {
      return this.getBasicDirectory(fullPath);
    }

    const dirName = this.formatDirectory(fullPath);

    switch (this.animationStyle) {
      case 'icon-pulse':
        return this.generateIconPulse(dirName, frameNumber);
      case 'scroll-text':
        return this.generateScrollText(fullPath, frameNumber);
      case 'folder-open':
        return this.generateFolderOpen(dirName, frameNumber);
      case 'breadcrumb':
        return this.generateBreadcrumb(fullPath, frameNumber);
      default:
        return this.getBasicDirectory(fullPath);
    }
  }

  /**
   * Pulsing folder icon
   */
  generateIconPulse(dirName, frame) {
    const icons = ['📁', '📂', '📁', '📂'];
    const icon = icons[frame % icons.length];
    
    return `\033[36m${icon}${dirName}\033[0m`;
  }

  /**
   * Scrolling text for long directory names
   */
  generateScrollText(fullPath, frame) {
    const dirName = this.formatDirectory(fullPath);
    
    if (dirName.length <= this.maxLength) {
      return `\033[36m📁${dirName}\033[0m`;
    }

    // Create scrolling effect
    const padding = '   '; // spaces between scroll cycles
    const scrollText = dirName + padding;
    const position = frame % scrollText.length;
    
    let displayText = '';
    for (let i = 0; i < this.maxLength; i++) {
      const charIndex = (position + i) % scrollText.length;
      displayText += scrollText[charIndex];
    }
    
    return `\033[36m📁${displayText}\033[0m`;
  }

  /**
   * Folder opening/closing animation
   */
  generateFolderOpen(dirName, frame) {
    const states = [
      '📁', // closed
      '📂', // slightly open
      '📂', // open
      '📁'  // closed
    ];
    
    const icon = states[frame % states.length];
    
    // Add subtle glow when "opening"
    if (frame % states.length === 1 || frame % states.length === 2) {
      return `\033[1;36m${icon}${dirName}\033[0m`;
    }
    
    return `\033[36m${icon}${dirName}\033[0m`;
  }

  /**
   * Animated breadcrumb path
   */
  generateBreadcrumb(fullPath, frame) {
    const pathParts = fullPath.split('/').filter(p => p.length > 0);
    
    if (pathParts.length <= 2) {
      return `\033[36m📁${this.formatDirectory(fullPath)}\033[0m`;
    }

    // Show different levels of the path
    const maxParts = 3;
    const totalParts = Math.min(pathParts.length, maxParts);
    const startIndex = Math.max(0, pathParts.length - totalParts);
    
    // Animate which part is highlighted
    const highlightIndex = frame % totalParts;
    
    let breadcrumb = '📁';
    const visibleParts = pathParts.slice(startIndex);
    
    visibleParts.forEach((part, index) => {
      if (index === highlightIndex) {
        breadcrumb += `\033[1;36m${part}\033[0;36m`;
      } else {
        breadcrumb += part;
      }
      
      if (index < visibleParts.length - 1) {
        breadcrumb += '/';
      }
    });
    
    return `\033[36m${breadcrumb}\033[0m`;
  }

  /**
   * Format directory name
   */
  formatDirectory(fullPath) {
    if (this.showFull) {
      return fullPath;
    }

    const dirName = fullPath.split('/').pop() || fullPath;
    
    if (dirName.length <= this.maxLength) {
      return dirName;
    }
    
    return dirName.substring(0, this.maxLength - 3) + '...';
  }

  /**
   * Get basic directory without animation
   */
  getBasicDirectory(fullPath) {
    const dirName = this.formatDirectory(fullPath);
    return `📁${dirName}`;
  }

  /**
   * Get current frame number
   */
  getCurrentFrame() {
    const now = Date.now();
    const speeds = { slow: 3000, medium: 2000, fast: 1000 };
    const interval = speeds[this.speed] || 3000;
    
    return Math.floor(now / interval);
  }
}

module.exports = AnimatedDirectoryComponent;