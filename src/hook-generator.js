#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

class HookGenerator {
  constructor() {
    this.hooksDir = path.join(__dirname, '..', 'generated-hooks');
  }

  /**
   * Generate hook from natural language description
   * @param {string} description - Natural language description of the hook
   * @param {string} projectPath - Optional project path for context
   */
  async generateHook(description, projectPath = process.cwd()) {
    console.log(chalk.blue('🎣 Rapala Hook Generator'));
    console.log(chalk.gray(`Analyzing: "${description}"`));
    console.log();

    const hookConfig = this.parseDescription(description);
    
    if (!hookConfig) {
      console.error(chalk.red('❌ Could not parse hook description'));
      console.log(chalk.yellow('💡 Try descriptions like:'));
      console.log(chalk.gray('  - "Format Python files after editing"'));
      console.log(chalk.gray('  - "Run tests before committing"'));
      console.log(chalk.gray('  - "Check for secrets before saving files"'));
      return;
    }

    console.log(chalk.green('✅ Hook configuration generated:'));
    console.log(chalk.cyan(JSON.stringify(hookConfig, null, 2)));
    console.log();

    // Ask if user wants to install via Rapala
    console.log(chalk.blue('📦 Ready to install with Rapala'));
    console.log(chalk.gray('Run the following command to install:'));
    console.log(chalk.white(`rapala install-custom "${JSON.stringify(hookConfig).replace(/"/g, '\\"')}"`));
    
    return hookConfig;
  }

  /**
   * Parse natural language description into hook configuration
   */
  parseDescription(description) {
    const desc = description.toLowerCase();
    
    // Determine event type
    let eventType = 'PostToolUse'; // default
    if (desc.includes('before') || desc.includes('prevent') || desc.includes('check') || desc.includes('validate')) {
      eventType = 'PreToolUse';
    } else if (desc.includes('finish') || desc.includes('complete') || desc.includes('done') || desc.includes('end')) {
      eventType = 'Stop';
    } else if (desc.includes('notify') || desc.includes('alert')) {
      eventType = 'Notification';
    }

    // Determine tool matcher
    let matcher = '';
    if (desc.includes('edit') || desc.includes('modif')) {
      matcher = 'Edit|MultiEdit|Write';
    } else if (desc.includes('write') || desc.includes('creat') || desc.includes('save')) {
      matcher = 'Write|Edit|MultiEdit';
    } else if (desc.includes('bash') || desc.includes('command') || desc.includes('shell')) {
      matcher = 'Bash';
    } else if (desc.includes('read') || desc.includes('view')) {
      matcher = 'Read';
    } else if (desc.includes('search') || desc.includes('grep')) {
      matcher = 'Grep|Glob';
    }

    // Generate command based on description
    let command = this.generateCommand(description);
    
    if (!command) {
      return null;
    }

    return {
      event: eventType,
      matcher: matcher || undefined,
      command: command,
      description: description
    };
  }

  /**
   * Generate command from description
   */
  generateCommand(description) {
    const desc = description.toLowerCase();
    
    // Python formatting
    if (desc.includes('format') && desc.includes('python')) {
      return 'black . --quiet 2>/dev/null || true';
    }
    
    // JavaScript/TypeScript formatting
    if (desc.includes('format') && (desc.includes('javascript') || desc.includes('js') || desc.includes('typescript') || desc.includes('ts'))) {
      return 'prettier --write "**/*.{js,ts,jsx,tsx}" 2>/dev/null || true';
    }
    
    // General formatting
    if (desc.includes('format')) {
      return 'prettier --write . 2>/dev/null || true';
    }
    
    // Testing
    if (desc.includes('test') && desc.includes('npm')) {
      return 'npm test 2>/dev/null || echo "Tests need attention"';
    }
    if (desc.includes('test') && desc.includes('pytest')) {
      return 'pytest -q 2>/dev/null || echo "Tests need attention"';
    }
    if (desc.includes('test')) {
      return 'npm test 2>/dev/null || pytest -q 2>/dev/null || echo "No test runner found"';
    }
    
    // Git operations
    if (desc.includes('git status')) {
      return 'git status --porcelain';
    }
    if (desc.includes('commit') && desc.includes('check')) {
      return 'git diff --cached --name-only | head -5';
    }
    
    // Security scanning
    if (desc.includes('secret') || desc.includes('key') || desc.includes('password')) {
      return 'git secrets --scan 2>/dev/null || echo "No secrets scanner installed"';
    }
    
    // Linting
    if (desc.includes('lint') && desc.includes('eslint')) {
      return 'eslint . --fix --quiet 2>/dev/null || true';
    }
    if (desc.includes('lint')) {
      return 'eslint . --fix --quiet 2>/dev/null || pylint . 2>/dev/null || echo "No linter found"';
    }
    
    // Building
    if (desc.includes('build') && desc.includes('npm')) {
      return 'npm run build 2>/dev/null || echo "No build script found"';
    }
    
    // Custom command extraction
    const commandMatch = description.match(/run\s+["`']([^"`']+)["`']/i);
    if (commandMatch) {
      return commandMatch[1];
    }
    
    // If we can't parse it, return null
    return null;
  }

  /**
   * Create hook from referenced document
   */
  async generateFromDocument(documentPath) {
    try {
      const content = await fs.readFile(documentPath, 'utf8');
      console.log(chalk.blue('📄 Processing document:'), documentPath);
      
      // Extract hook-related rules from document
      const rules = this.extractRulesFromDocument(content);
      
      if (rules.length === 0) {
        console.log(chalk.yellow('⚠️  No hook rules found in document'));
        console.log(chalk.gray('Look for patterns like:'));
        console.log(chalk.gray('  - "Format code after editing"'));
        console.log(chalk.gray('  - "Run tests before committing"'));
        return;
      }

      console.log(chalk.green(`✅ Found ${rules.length} potential hook rules:`));
      rules.forEach((rule, i) => {
        console.log(chalk.cyan(`${i + 1}. ${rule}`));
      });
      
      // Generate hooks for each rule
      const hookConfigs = [];
      for (const rule of rules) {
        const config = this.parseDescription(rule);
        if (config) {
          hookConfigs.push(config);
        }
      }
      
      return hookConfigs;
    } catch (error) {
      console.error(chalk.red('❌ Error reading document:'), error.message);
      return [];
    }
  }

  /**
   * Extract potential hook rules from document content
   */
  extractRulesFromDocument(content) {
    const rules = [];
    const lines = content.split('\n');
    
    // Look for lines that might be hook rules
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue;
      }
      
      // Look for hook-like patterns
      const hookPatterns = [
        /format.*after.*edit/i,
        /run.*test.*before/i,
        /check.*before.*save/i,
        /lint.*after/i,
        /build.*when/i,
        /(before|after).*\b(edit|save|write|commit|build|test|format|lint)\b/i,
        /\b(format|lint|test|build|check|validate|scan)\b.*\b(before|after|when)\b/i
      ];
      
      if (hookPatterns.some(pattern => pattern.test(line))) {
        rules.push(line.trim());
      }
    }
    
    return rules;
  }
}

// CLI interface
if (require.main === module) {
  const generator = new HookGenerator();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(chalk.red('❌ No description provided'));
    console.log(chalk.yellow('Usage:'));
    console.log(chalk.gray('  node hook-generator.js "Format Python files after editing"'));
    console.log(chalk.gray('  node hook-generator.js --document ./rules.md'));
    process.exit(1);
  }
  
  if (args[0] === '--document' && args[1]) {
    generator.generateFromDocument(args[1]);
  } else {
    const description = args.join(' ');
    generator.generateHook(description);
  }
}

module.exports = HookGenerator;