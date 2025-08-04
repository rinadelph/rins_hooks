const HookBase = require('../../src/hook-base');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ConversationTitlerHook extends HookBase {
  constructor(config = {}) {
    super('conversation-titler', config);
  }

  getDefaultConfig() {
    return {
      enabled: true,
      description: "Automatically generates meaningful conversation titles instead of generic resumed conversation titles",
      matcher: ".*", // Listen to all tools to detect conversation activity
      timeout: 30,
      titleLength: 60,
      includeEmoji: true,
      blacklistPatterns: [
        "This session is being continued",
        "Claude Code conversation",
        "Resumed conversation"
      ],
      titleTemplates: {
        code: "💻 Code: {{summary}}",
        analysis: "🔍 Analysis: {{summary}}",
        debug: "🐛 Debug: {{summary}}", 
        git: "🔄 Git: {{summary}}",
        docs: "📝 Docs: {{summary}}",
        config: "⚙️ Config: {{summary}}",
        default: "{{emoji}} {{summary}}"
      }
    };
  }

  async execute(input) {
    try {
      const { tool_name, tool_input, session_id } = input;
      
      // Only process after tool execution (PostToolUse equivalent)
      if (!tool_input) return this.success({ message: 'No tool input to process' });

      // Get project path from current working directory
      const projectPath = this.encodeProjectPath(process.cwd());
      const projectDir = path.join(require('os').homedir(), '.claude', 'projects', projectPath);
      
      // Find current session's summary file
      const summaryFile = await this.findCurrentSummaryFile(projectDir, session_id);
      if (!summaryFile) {
        return this.success({ message: 'No summary file found' });
      }

      // Read current title
      const currentTitle = await this.getCurrentTitle(summaryFile);
      
      // Check if title needs updating (is generic)
      if (!this.isGenericTitle(currentTitle)) {
        return this.success({ message: 'Title already customized' });
      }

      // Generate new meaningful title based on conversation context
      const newTitle = await this.generateMeaningfulTitle(tool_name, tool_input, projectDir);
      
      // Update the summary file
      await this.updateConversationTitle(summaryFile, newTitle);
      
      return this.success({ 
        message: `Updated conversation title: "${newTitle}"`,
        data: { oldTitle: currentTitle, newTitle }
      });
      
    } catch (error) {
      return this.error(`Conversation titler failed: ${error.message}`);
    }
  }

  encodeProjectPath(projectPath) {
    // Convert /home/user/project to -home-user-project (Claude's encoding pattern)
    return projectPath.replace(/\//g, '-').replace(/^-/, '');
  }

  async findCurrentSummaryFile(projectDir, sessionId) {
    try {
      const files = await fs.readdir(projectDir);
      
      // Look for small JSONL files (summaries are ~1KB)
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);
        
        // Summary files are typically under 5KB
        if (stats.size > 5000) continue;
        
        const content = await fs.readFile(filePath, 'utf8');
        // Check if this summary file contains recent entries
        if (content.includes('"type":"summary"')) {
          return filePath;
        }
      }
    } catch (error) {
      // Directory or files might not exist yet
      return null;
    }
    
    return null;
  }

  async getCurrentTitle(summaryFile) {
    try {
      const content = await fs.readFile(summaryFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return '';
      
      // Get the most recent summary (last line)
      const lastLine = lines[lines.length - 1];
      const summary = JSON.parse(lastLine);
      
      return summary.summary || '';
    } catch (error) {
      return '';
    }
  }

  isGenericTitle(title) {
    const genericPatterns = [
      'This session is being continued',
      'Claude Code conversation',
      'Resumed conversation',
      'Session resumed',
      'Conversation continued'
    ];
    
    return genericPatterns.some(pattern => 
      title.toLowerCase().includes(pattern.toLowerCase())
    ) || title.trim() === '';
  }

  async generateMeaningfulTitle(toolName, toolInput, projectDir) {
    try {
      // Analyze recent conversation context
      const context = await this.analyzeConversationContext(projectDir);
      
      // Generate title based on tool and context
      let category = 'default';
      let summary = '';
      
      // Determine category from tool and input
      if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
        category = 'code';
        summary = this.generateCodeSummary(toolInput);
      } else if (toolName === 'Bash') {
        if (toolInput.command && toolInput.command.includes('git')) {
          category = 'git';
          summary = this.generateGitSummary(toolInput.command);
        } else {
          summary = this.generateBashSummary(toolInput.command);
        }
      } else if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
        category = 'analysis';
        summary = this.generateAnalysisSummary(toolInput);
      } else {
        summary = this.generateDefaultSummary(toolName, context);
      }

      // Apply template
      const template = this.config.titleTemplates[category] || this.config.titleTemplates.default;
      const emoji = this.selectEmoji(category, summary);
      
      let title = template
        .replace('{{summary}}', summary)
        .replace('{{emoji}}', emoji);
      
      // Truncate if too long
      if (title.length > this.config.titleLength) {
        title = title.substring(0, this.config.titleLength - 3) + '...';
      }
      
      return title;
      
    } catch (error) {
      // Fallback title
      return `🔄 Session: ${new Date().toISOString().split('T')[0]}`;
    }
  }

  generateCodeSummary(toolInput) {
    if (toolInput.file_path) {
      const fileName = path.basename(toolInput.file_path);
      const ext = path.extname(fileName);
      
      if (toolInput.new_string && toolInput.old_string) {
        return `Modified ${fileName}`;
      } else if (toolInput.content) {
        return `Created ${fileName}`;
      } else {
        return `Edited ${ext} file`;
      }
    }
    return 'Code modification';
  }

  generateGitSummary(command) {
    if (command.includes('commit')) return 'Git commit';
    if (command.includes('push')) return 'Git push';
    if (command.includes('pull')) return 'Git pull';
    if (command.includes('status')) return 'Git status check';
    if (command.includes('diff')) return 'Git diff review';
    return 'Git operation';
  }

  generateBashSummary(command) {
    if (!command) return 'Shell command';
    
    const cmd = command.split(' ')[0];
    switch (cmd) {
      case 'npm': return 'NPM operation';
      case 'yarn': return 'Yarn operation';
      case 'docker': return 'Docker operation';
      case 'pytest': return 'Python tests';
      case 'jest': return 'JavaScript tests';
      case 'cargo': return 'Rust build';
      case 'make': return 'Build process';
      default: return `Shell: ${cmd}`;
    }
  }

  generateAnalysisSummary(toolInput) {
    if (toolInput.pattern) {
      return `Search: ${toolInput.pattern}`;
    } else if (toolInput.file_path) {
      const fileName = path.basename(toolInput.file_path);
      return `Analyzed ${fileName}`;
    }
    return 'Code analysis';
  }

  generateDefaultSummary(toolName, context) {
    const projectName = path.basename(process.cwd());
    return `${toolName} in ${projectName}`;
  }

  selectEmoji(category, summary) {
    if (!this.config.includeEmoji) return '';
    
    const emojiMap = {
      code: ['💻', '⚡', '🔧', '✨'],
      git: ['🔄', '📝', '🚀', '🔀'],
      analysis: ['🔍', '📊', '🔎', '🧐'],
      debug: ['🐛', '🔧', '⚡', '🔍'],
      docs: ['📝', '📋', '📄', '✍️'],
      config: ['⚙️', '🔧', '⚡', '🔩'],
      default: ['🔄', '⚡', '✨', '🎯']
    };
    
    const emojis = emojiMap[category] || emojiMap.default;
    
    // Select emoji based on summary content hash for consistency
    const hash = crypto.createHash('md5').update(summary).digest('hex');
    const index = parseInt(hash.substr(0, 2), 16) % emojis.length;
    
    return emojis[index];
  }

  async analyzeConversationContext(projectDir) {
    // This could be expanded to analyze recent messages for better context
    // For now, return basic project context
    return {
      projectName: path.basename(process.cwd()),
      hasGit: await this.hasGitRepo(),
      language: await this.detectPrimaryLanguage()
    };
  }

  async hasGitRepo() {
    try {
      await fs.access('.git');
      return true;
    } catch {
      return false;
    }
  }

  async detectPrimaryLanguage() {
    try {
      const files = await fs.readdir('.');
      
      if (files.includes('package.json')) return 'javascript';
      if (files.includes('Cargo.toml')) return 'rust';
      if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'python';
      if (files.includes('go.mod')) return 'go';
      if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async updateConversationTitle(summaryFile, newTitle) {
    try {
      const content = await fs.readFile(summaryFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      // Update the most recent summary (last line)
      const lastLineIndex = lines.length - 1;
      const summary = JSON.parse(lines[lastLineIndex]);
      summary.summary = newTitle;
      lines[lastLineIndex] = JSON.stringify(summary);
      
      // Write back to file
      await fs.writeFile(summaryFile, lines.join('\n') + '\n', 'utf8');
      
    } catch (error) {
      throw new Error(`Failed to update summary file: ${error.message}`);
    }
  }
}

// Enable direct execution
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new ConversationTitlerHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = ConversationTitlerHook;