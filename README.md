# Rins Hooks - Advanced Claude Code Git Integration

A sophisticated hook system for Claude Code that provides intelligent git management and conversation archiving across multiple projects.

## 🚀 Key Features

### 🤖 Intelligent Git Manager
- **Auto-initialization**: Automatically initializes git repositories in new projects
- **Smart commits**: Creates meaningful commit messages with conversation context
- **Multi-project support**: Works seamlessly across different project directories
- **Change analysis**: Intelligently categorizes changes (feat, fix, chore, etc.)

### 📚 Session-Based Conversation Archiver
- **Session isolation**: Each conversation gets its own git worktree
- **Conversation tracking**: Archives user prompts and tool executions
- **Message numbering**: Maintains chronological order of interactions
- **Tool execution logs**: Detailed records of all tool usage

## 🌐 Cross-Platform Support

Works universally across all devices and operating systems:
- ✅ **Windows** (10, 11) - Native PowerShell integration
- ✅ **macOS** (Intel & Apple Silicon) - Native osascript notifications  
- ✅ **Linux** (Ubuntu, CentOS, Arch) - Native notify-send support
- ✅ **Node.js** 16+ - Tested on LTS versions

## 🚀 Quick Start

Install globally with npm:

```bash
npm install -g rins_hooks
```

Install hooks interactively:

```bash
rins_hooks install --interactive
```

Or install specific hooks:

```bash
rins_hooks install auto-commit code-formatter notification extended-thinking
```

## 📋 Available Hooks

### 🔄 Auto-Commit Hook
Automatically commits file changes with contextual messages after every Claude Code file modification.

**Features:**
- Smart commit messages with tool context
- File path and change type detection
- Configurable exclusion patterns
- Branch-aware behavior

### 🎨 Code Formatter Hook
Automatically formats code after file modifications using popular formatters.

**Features:**
- Support for multiple languages (JS/TS, Python, Go, Rust, Java, C/C++)
- Project configuration detection
- Configurable formatters per file type
- Graceful error handling

### 🔔 Notification Hook
Enhanced notifications for Claude Code events with multiple delivery methods.

**Features:**
- Cross-platform desktop notifications
- Slack/Discord/Teams integration
- Custom notification commands
- Configurable notification types

### 🚫 Task Blocker Hook
Prevents Claude Code from using the Task tool and creating subagents.

**Features:**
- Blocks Task tool usage via Claude Code permissions
- Forces Claude to work directly without subagents
- Clean blocking without errors
- Activity logging for debugging

### 🧠 Extended Thinking Hook
Provides comprehensive extended thinking capabilities with user control through toggles and explicit commands.

**Features:**
- **Auto-Mode**: Toggleable extended/deep thinking for all prompts
- **Explicit Commands**: `/think`, `/deep-think`, `/think-toggle`, `/deep-toggle`, `/think-status`
- **Priority System**: Deep thinking takes precedence over regular extended thinking
- **Project-Level State**: Per-project thinking preferences stored in `.claude/extended-thinking-state.json`

## 📖 Installation Options

### Global Installation (Recommended)
Install for all Claude Code projects:
```bash
rins_hooks install auto-commit --user
```

### Project Installation
Install for current project only:
```bash
rins_hooks install auto-commit --project
```

### Local Installation
Install locally (not committed to git):
```bash
rins_hooks install auto-commit --local
```

## 🔧 Commands

### Installation
```bash
# Interactive installation
rins_hooks install --interactive

# Install specific hooks
rins_hooks install auto-commit notification

# Install all hooks
rins_hooks install --all

# Dry run (preview changes)
rins_hooks install auto-commit --dry-run
```

### Management
```bash
# List available hooks
rins_hooks list

# Show installation status
rins_hooks status

# Show configuration
rins_hooks config --show

# Validate configuration
rins_hooks config --validate

# Run diagnostics
rins_hooks doctor
```

### Uninstallation
```bash
# Uninstall specific hooks
rins_hooks uninstall auto-commit

# Uninstall all hooks
rins_hooks uninstall --all
```

## ⚙️ Configuration

### Auto-Commit Hook Configuration

The auto-commit hook can be customized through its configuration:

```json
{
  "commitMessageTemplate": "Auto-commit: {{toolName}} modified {{fileName}}\\n\\n- File: {{filePath}}\\n- Tool: {{toolName}}\\n- Session: {{sessionId}}\\n\\n🤖 Generated with Claude Code via rins_hooks\\nCo-Authored-By: Claude <noreply@anthropic.com>",
  "excludePatterns": [
    "*.log", "*.tmp", ".env*", "*.key", "node_modules/**", ".git/**"
  ],
  "skipEmptyCommits": true,
  "branchRestrictions": ["main", "master"],
  "maxCommitMessageLength": 500
}
```

### Code Formatter Configuration

Configure formatters for different file types:

```json
{
  "formatters": {
    ".js": "prettier --write",
    ".py": "black",
    ".go": "gofmt -w",
    ".rs": "rustfmt"
  },
  "excludePatterns": ["node_modules/**", "dist/**"],
  "failOnError": false
}
```

### Notification Configuration

Set up notifications and integrations:

```json
{
  "desktopNotifications": true,
  "integrations": {
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/...",
      "channel": "#dev"
    },
    "discord": {
      "enabled": true,
      "webhook": "https://discord.com/api/webhooks/..."
    }
  }
}
```

## 🛠️ Requirements

- **Node.js**: >= 16.0.0
- **Claude Code**: Latest version
- **Git**: For auto-commit functionality
- **Formatters**: Optional, based on enabled hooks

## 🔍 Diagnostics

Run the built-in diagnostics to check your setup:

```bash
rins_hooks doctor
```

This will check:
- ✅ Node.js version compatibility
- ✅ Claude Code installation
- ✅ Git availability and repository status
- ✅ Settings directory permissions
- ✅ Configuration file validity

## 📁 File Structure

```
~/.claude/                          # Claude Code settings directory
├── settings.json                   # User-level hooks
└── projects/
    └── your-project/
        └── .claude/
            ├── settings.json       # Project-level hooks
            └── settings.local.json # Local hooks (not committed)
```

## 🔒 Security Considerations

- Hooks execute with your user permissions
- Review hook configurations before installation
- Use project-level installation for team settings
- Keep sensitive configurations in local settings
- Regularly update to latest versions

## 🐛 Troubleshooting

### Common Issues

**Hook not executing:**
```bash
# Check installation status
rins_hooks status

# Validate configuration
rins_hooks config --validate

# Run diagnostics
rins_hooks doctor
```

**Permission errors:**
- Ensure Claude Code settings directory is writable
- Check file permissions on hook scripts
- Verify git repository permissions for auto-commit

**Formatter not found:**
- Install required formatters globally
- Check PATH configuration
- Use `rins_hooks doctor` to verify dependencies

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Add your hook or improvement
4. Test thoroughly across platforms
5. Submit a pull request

### Creating Custom Hooks

Extend the `HookBase` class:

```javascript
const HookBase = require('rins_hooks/src/hook-base');

class MyCustomHook extends HookBase {
  constructor(config = {}) {
    super('my-custom-hook', config);
  }

  async execute(input) {
    // Your hook logic here
    return this.success({ message: 'Hook executed successfully' });
  }
}
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [GitHub Repository](https://github.com/your-username/rins_hooks)
- [Issue Tracker](https://github.com/your-username/rins_hooks/issues)
- [NPM Package](https://www.npmjs.com/package/rins_hooks)

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude Code
- Open source community for formatter tools
- Contributors and testers

---

**Made with ❤️ for the Claude Code community**