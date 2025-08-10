/**
 * Animated Git Component Metadata  
 * Provides metadata for the animated git component
 */

module.exports = {
  name: 'animated-git',
  displayName: 'Animated Git',
  description: 'Git status with rotating icons and status effects',
  icon: '🌿',
  configurable: true,
  animated: true,
  defaultConfig: { 
    animationStyle: 'icon-rotation',
    showStatus: true,
    speed: 'medium',
    enabled: true
  },
  animationStyles: [
    { name: 'icon-rotation', description: 'Rotating git status icons' },
    { name: 'status-pulse', description: 'Pulsing for dirty repos' },
    { name: 'branch-glow', description: 'Glowing branch names' },
    { name: 'activity-indicator', description: 'Progressive activity dots' }
  ],
  componentClass: require('./animated-git')
};