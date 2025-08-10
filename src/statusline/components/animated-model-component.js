/**
 * Animated Model Component Metadata
 * Provides metadata for the animated model component
 */

module.exports = {
  name: 'animated-model',
  displayName: 'Animated Model',
  description: 'Model name with pulsing and color animations',
  icon: '🤖',
  configurable: true,
  animated: true,
  defaultConfig: { 
    animationStyle: 'pulse',
    speed: 'medium',
    colors: ['magenta', 'blue', 'cyan'],
    enabled: true
  },
  animationStyles: [
    { name: 'pulse', description: 'Brightness pulsing effect' },
    { name: 'color-cycle', description: 'Rotating through colors' },
    { name: 'glow', description: 'Background glow effect' },
    { name: 'typewriter', description: 'Character-by-character reveal' }
  ],
  componentClass: require('./animated-model')
};