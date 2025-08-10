/**
 * Animated Directory Component Metadata
 * Provides metadata for the animated directory component
 */

module.exports = {
  name: 'animated-directory',
  displayName: 'Animated Directory',
  description: 'Directory path with icon animations and scrolling',
  icon: '📁',
  configurable: true,
  animated: true,
  defaultConfig: { 
    animationStyle: 'icon-pulse',
    showFull: false,
    maxLength: 20,
    speed: 'slow',
    enabled: true
  },
  animationStyles: [
    { name: 'icon-pulse', description: 'Folder icon switching' },
    { name: 'scroll-text', description: 'Horizontal text scrolling' },
    { name: 'folder-open', description: 'Folder opening animation' },
    { name: 'breadcrumb', description: 'Animated path highlighting' }
  ],
  componentClass: require('./animated-directory')
};