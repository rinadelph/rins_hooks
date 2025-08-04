#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

class HookGenerator {
  constructor() {
    this.hooksDir = path.join(__dirname, '..', 'hooks');
  }

  /**
   * Generate dynamic hook from natural language description
   * @param {string} description - Natural language description of the hook
   * @param {string} projectPath - Optional project path for context
   */
  async generateHook(description, projectPath = process.cwd(), silent = false) {
    if (!silent) {
      console.log(chalk.blue('🎣 Rapala Hook Generator'));
      console.log(chalk.gray(`Analyzing: "${description}"`));
      console.log();
    }

    const hookSpec = this.parseDescription(description);
    
    if (!hookSpec) {
      console.error(chalk.red('❌ Could not parse hook description'));
      console.log(chalk.yellow('💡 Try descriptions like:'));
      console.log(chalk.gray('  - "Format Python files after editing"'));
      console.log(chalk.gray('  - "Run tests before committing"'));
      console.log(chalk.gray('  - "Check for secrets before saving files"'));
      return;
    }

    // Generate dynamic hook
    const dynamicHook = await this.createDynamicHook(hookSpec, description);
    
    if (!silent) {
      console.log(chalk.green('✅ Dynamic hook generated:'));
      console.log(chalk.cyan(`Name: ${dynamicHook.name}`));
      console.log(chalk.cyan(`Event: ${dynamicHook.event}`));
      console.log(chalk.cyan(`Matcher: ${dynamicHook.matcher || '(all tools)'}`));
      console.log(chalk.cyan(`File: ${dynamicHook.hookFile}`));
      console.log();

      console.log(chalk.blue('📦 Claude Code Configuration:'));
      console.log(chalk.white(JSON.stringify(dynamicHook.claudeConfig, null, 2)));
      console.log();

      console.log(chalk.green('🚀 To install this hook:'));
      console.log(chalk.gray(`1. Hook file created: ${dynamicHook.hookFile}`));
      console.log(chalk.gray(`2. Add the JSON above to your Claude Code settings.json`));
      console.log(chalk.gray(`3. Or use: rapala install ${dynamicHook.name}`));
    }
    
    return dynamicHook;
  }

  /**
   * Create dynamic hook JavaScript file from specification
   */
  async createDynamicHook(hookSpec, originalDescription) {
    const hookName = this.generateHookName(originalDescription);
    const hookDir = path.join(this.hooksDir, hookName);
    
    // Ensure hook directory exists
    await fs.ensureDir(hookDir);
    
    // Generate hook logic based on the specification
    const hookLogic = this.generateHookLogic(hookSpec, originalDescription);
    
    // Read template and replace placeholders
    const templatePath = path.join(__dirname, '..', 'templates', 'dynamic-hook-template.js');
    let template = await fs.readFile(templatePath, 'utf8');
    
    template = template
      .replace(/{{DESCRIPTION}}/g, originalDescription)
      .replace(/{{HOOK_NAME}}/g, hookName)
      .replace(/{{MATCHER}}/g, hookSpec.matcher || '')
      .replace(/{{HOOK_BASE_PATH}}/g, '../../../src/hook-base')
      .replace(/{{HOOK_LOGIC}}/g, hookLogic);
    
    // Write the dynamic hook file
    const hookFile = path.join(hookDir, 'index.js');
    await fs.writeFile(hookFile, template);
    
    // Create config.json for the hook
    const config = {
      name: hookName,
      description: originalDescription,
      version: '1.0.0',
      author: 'Rapala Hook Generator',
      tags: ['generated', 'dynamic', hookSpec.matcher?.toLowerCase() || 'general'],
      platforms: ['linux', 'darwin', 'win32'],
      events: [hookSpec.event],
      installationType: 'generated'
    };
    
    await fs.writeFile(path.join(hookDir, 'config.json'), JSON.stringify(config, null, 2));
    
    // Generate Claude Code configuration
    const claudeConfig = {
      [hookSpec.event]: [{
        matcher: hookSpec.matcher,
        hooks: [{
          type: 'command',
          command: `node "${hookFile}"`
        }]
      }]
    };
    
    // Remove undefined matcher
    if (!hookSpec.matcher) {
      delete claudeConfig[hookSpec.event][0].matcher;
    }
    
    return {
      name: hookName,
      event: hookSpec.event,
      matcher: hookSpec.matcher,
      hookFile,
      claudeConfig,
      config
    };
  }

  /**
   * Generate hook name from description
   */
  generateHookName(description) {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)
      .replace(/-+$/, '') + '-' + Date.now().toString().slice(-6);
  }

  /**
   * Generate hook logic JavaScript code
   */
  generateHookLogic(hookSpec, description) {
    const desc = description.toLowerCase();
    
    // Tmux bash session management
    if (desc.includes('tmux') && desc.includes('bash') && desc.includes('session')) {
      return `
      // Tmux session management for bash commands
      const { execSync } = require('child_process');
      
      if (input.tool_name === 'Bash') {
        const command = input.tool_input?.command || '';
        const sessionName = 'claude-bash-' + Date.now();
        
        console.log('🎣 Creating dedicated tmux session for bash command');
        console.log('Session:', sessionName);
        console.log('Command:', command);
        
        try {
          // Create tmux session and execute command in new pane
          execSync(\`tmux new-session -d -s "\${sessionName}" bash -c "
            echo 'Claude Code Bash Command Session'
            echo 'Session: \${sessionName}'
            echo 'Command: \${command}'
            echo '======================================'
            \${command}
            echo '======================================'
            echo 'Command completed. This session will close in 10 minutes...'
            sleep 600
            tmux kill-session -t \${sessionName}
          "\`, { stdio: 'inherit' });
          
          console.log('✅ Command executed in tmux session:', sessionName);
          console.log('💡 Use "tmux attach -t', sessionName, '" to view the session');
          console.log('⏰ Session will auto-close in 10 minutes');
          
        } catch (error) {
          console.error('❌ Failed to create tmux session:', error.message);
        }
      }`;
    }
    
    // Simple command execution
    return `
      // Generated hook logic for: ${description}
      const { execSync } = require('child_process');
      
      console.log('🎣 Executing generated hook:', '${description}');
      
      try {
        const command = '${hookSpec.command || 'echo "Hook executed successfully"'}';
        execSync(command, { stdio: 'inherit' });
      } catch (error) {
        console.error('Hook execution failed:', error.message);
      }`;
  }

  /**
   * Parse natural language description into hook configuration
   */
  parseDescription(description) {
    const desc = description.toLowerCase();
    
    // Determine event type
    let eventType = 'PreToolUse'; // default for command interception
    
    // Special handling for bash command interception
    if (desc.includes('bash') && (desc.includes('run') || desc.includes('command') || desc.includes('execute'))) {
      eventType = 'PreToolUse'; // Intercept before execution
    } else if (desc.includes('after') || desc.includes('following') || desc.includes('once done') || desc.includes('when finished')) {
      eventType = 'PostToolUse';
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
    } else if (desc.includes('bash') || desc.includes('command') || desc.includes('shell') || desc.includes('tmux')) {
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
    
    // Tmux session management for bash commands
    if (desc.includes('tmux') && desc.includes('bash') && desc.includes('session')) {
      if (desc.includes('pane') && desc.includes('command')) {
        // Complex tmux session with panes and auto-cleanup
        return '/home/alejandro/Code/MCP/Hooks/Git/rins_hooks/scripts/tmux-bash-manager.sh "$CLAUDE_TOOL_ARGS"';
      }
      return 'tmux new-session -d -s "claude-\$(date +%s)" "\$CLAUDE_TOOL_ARGS" 2>/dev/null || echo "Tmux session created"';
    }
    
    // Bash command wrapping
    if (desc.includes('bash') && (desc.includes('wrap') || desc.includes('run'))) {
      return 'echo "Running: \$CLAUDE_TOOL_ARGS"; \$CLAUDE_TOOL_ARGS';
    }
    
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