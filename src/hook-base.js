const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class HookBase {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...this.getDefaultConfig(), ...config };
    this.hookDir = path.join(__dirname, '..', 'hooks', name);
  }

  /**
   * Get default configuration for this hook
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      enabled: true,
      matcher: '',
      timeout: 60,
      description: 'A Claude Code hook'
    };
  }

  /**
   * Execute the hook with the given input
   * @param {Object} input - Hook input data from Claude Code
   * @returns {Promise<Object>} Hook result
   */
  execute(_input) {
    throw new Error('execute() method must be implemented by subclass');
  }

  /**
   * Validate the hook configuration
   * @returns {Promise<boolean>} True if valid
   */
  async validate() {
    try {
      // Check if hook directory exists
      if (!await fs.pathExists(this.hookDir)) {
        throw new Error(`Hook directory not found: ${this.hookDir}`);
      }

      // Check if hook has required files
      const requiredFiles = ['index.js', 'config.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(this.hookDir, file);
        if (!await fs.pathExists(filePath)) {
          throw new Error(`Required file not found: ${file}`);
        }
      }

      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Hook validation failed for ${this.name}:`), error.message);
      return false;
    }
  }

  /**
   * Get hook metadata
   * @returns {Promise<Object>} Hook metadata
   */
  async getMetadata() {
    try {
      const configPath = path.join(this.hookDir, 'config.json');
      const config = await fs.readJson(configPath);

      return {
        name: this.name,
        description: config.description || this.config.description,
        version: config.version || '1.0.0',
        tags: config.tags || [],
        requirements: config.requirements || [],
        platforms: config.platforms || ['linux', 'darwin', 'win32'],
        matcher: config.matcher || this.config.matcher,
        timeout: config.timeout || this.config.timeout
      };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not load metadata for ${this.name}`));
      return {
        name: this.name,
        description: this.config.description,
        version: '1.0.0',
        tags: [],
        requirements: [],
        platforms: ['linux', 'darwin', 'win32'],
        matcher: this.config.matcher,
        timeout: this.config.timeout
      };
    }
  }

  /**
   * Generate Claude Code hook configuration
   * @param {string} eventType - Hook event type (PreToolUse, PostToolUse, etc.)
   * @returns {Object} Claude Code hook configuration
   */
  generateHookConfig() {
    const hookScript = path.join(this.hookDir, 'index.js');

    return {
      matcher: this.config.matcher,
      hooks: [
        {
          type: 'command',
          command: `node "${hookScript}"`,
          timeout: this.config.timeout
        }
      ]
    };
  }

  /**
   * Return success result
   * @param {*} data - Success data
   * @returns {Object} Success result
   */
  success(data = null) {
    return {
      success: true,
      data: data,
      hook: this.name
    };
  }

  /**
   * Return error result
   * @param {string} message - Error message
   * @param {*} data - Error data
   * @returns {Object} Error result
   */
  error(message, data = null) {
    return {
      success: false,
      error: message,
      data: data,
      hook: this.name
    };
  }

  /**
   * Return blocking result (exit code 2)
   * @param {string} reason - Blocking reason
   * @returns {Object} Blocking result
   */
  block(reason) {
    return {
      decision: 'block',
      reason: reason,
      hook: this.name
    };
  }

  /**
   * Return approval result (bypass permissions)
   * @param {string} reason - Approval reason
   * @returns {Object} Approval result
   */
  approve(reason) {
    return {
      decision: 'approve',
      reason: reason,
      hook: this.name
    };
  }

  /**
   * Parse JSON input from stdin
   * @returns {Promise<Object>} Parsed input
   */
  static parseInput() {
    return new Promise((resolve, reject) => {
      let input = '';

      process.stdin.on('data', (chunk) => {
        input += chunk.toString();
      });

      process.stdin.on('end', () => {
        try {
          const data = JSON.parse(input);
          resolve(data);
        } catch (error) {
          reject(new Error(`Invalid JSON input: ${error.message}`));
        }
      });

      process.stdin.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Output result to stdout
   * @param {Object} result - Result to output
   */
  static outputResult(result) {
    if (result.success === false) {
      // Error result - output to stderr and exit with non-zero code
      console.error(result.error);
      process.exit(result.decision === 'block' ? 2 : 1);
    } else if (result.decision === 'block') {
      // Blocking result - output to stderr and exit with code 2
      console.error(result.reason);
      process.exit(2);
    } else if (result.decision === 'approve') {
      // Approval result - output to stdout
      console.log(JSON.stringify(result));
      process.exit(0);
    } else {
      // Success result - output to stdout
      if (result.data) {
        console.log(JSON.stringify(result.data));
      }
      process.exit(0);
    }
  }
}

module.exports = HookBase;
