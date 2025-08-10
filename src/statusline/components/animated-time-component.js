/**
 * Animated Time Component Metadata
 * Provides metadata for the animated time component  
 */

module.exports = {
  name: 'animated-time',
  displayName: 'Animated Time',
  description: 'Time display with blinking separators and color transitions',
  icon: '⏰',
  configurable: true,
  animated: true,
  defaultConfig: { 
    animationStyle: 'separator-blink',
    format: '24h',
    showSeconds: false,
    speed: 'medium',
    enabled: true
  },
  animationStyles: [
    { name: 'separator-blink', description: 'Blinking time separators' },
    { name: 'color-transition', description: 'Time-of-day color changes' },
    { name: 'digital-clock', description: 'Digital clock glow effect' },
    { name: 'smooth-update', description: 'Progressive update animation' }
  ],
  componentClass: require('./animated-time')
};