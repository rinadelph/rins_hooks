# Available Hooks

This document provides detailed information about all available hooks in the rins_hooks collection.

## 🔄 Auto-Commit Hook

**Purpose**: Automatically commit file changes with contextual messages after every Claude Code file modification.

### Features
- **Smart Commit Messages**: Includes tool name, file path, and session information
- **File Exclusion**: Skip sensitive files like `.env`, `.git/`, `*.key`
- **Branch Restrictions**: Optionally restrict commits on specific branches
- **Empty Commit Handling**: Skip commits when no changes are detected
- **Customizable Templates**: Configure commit message format

### Configuration

```json
{
  "commitMessageTemplate": "Auto-commit: {{toolName}} modified {{fileName}}\n\n- File: {{filePath}}\n- Tool: {{toolName}}\n- Session: {{sessionId}}\n\n🤖 Generated with Claude Code via rins_hooks\nCo-Authored-By: Claude <noreply@anthropic.com>",
  "excludePatterns": [
    "*.log",
    "*.tmp", 
    "*.temp",
    ".env*",
    "*.key",
    "*.pem",
    "node_modules/**",
    ".git/**",
    "*.pyc",
    "__pycache__/**"
  ],
  "skipEmptyCommits": true,
  "addAllFiles": false,
  "branchRestrictions": ["main", "master"],
  "maxCommitMessageLength": 500
}
```

### Template Variables
- `{{toolName}}`: The Claude Code tool used (Edit, Write, MultiEdit)
- `{{fileName}}`: Base name of the modified file
- `{{filePath}}`: Full path to the modified file
- `{{sessionId}}`: Claude Code session identifier

### Example Commit Message
```
Auto-commit: Edit modified config.js

- File: /home/user/project/config.js
- Tool: Edit
- Session: abc123-def456

🤖 Generated with Claude Code via rins_hooks
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Requirements
- Git repository
- Write permissions to repository

---

## 🎨 Code Formatter Hook

**Purpose**: Automatically format code after file modifications using popular formatters.

### Features
- **Multi-Language Support**: JavaScript, TypeScript, Python, Go, Rust, Java, C/C++
- **Project Configuration**: Automatically detects and uses project-specific formatter configs
- **Extensible**: Easy to add new formatters and file types
- **Error Handling**: Graceful degradation when formatters are unavailable
- **Exclude Patterns**: Skip files that shouldn't be formatted

### Supported Formatters

| Language | File Extensions | Default Formatter | Config Files |
|----------|----------------|-------------------|--------------|
| JavaScript/TypeScript | `.js`, `.jsx`, `.ts`, `.tsx` | Prettier | `.prettierrc`, `prettier.config.js` |
| JSON | `.json` | Prettier | `.prettierrc` |
| CSS/SCSS | `.css`, `.scss` | Prettier | `.prettierrc` |
| HTML | `.html` | Prettier | `.prettierrc` |
| Markdown | `.md` | Prettier | `.prettierrc` |
| Python | `.py` | Black | `pyproject.toml`, `setup.cfg` |
| Go | `.go` | gofmt | - |
| Rust | `.rs` | rustfmt | `rustfmt.toml` |
| Java | `.java` | google-java-format | - |
| C/C++ | `.c`, `.cpp`, `.h` | clang-format | `.clang-format` |

### Configuration

```json
{
  "formatters": {
    ".js": "prettier --write",
    ".jsx": "prettier --write",
    ".ts": "prettier --write",
    ".tsx": "prettier --write",
    ".json": "prettier --write",
    ".css": "prettier --write",
    ".scss": "prettier --write",
    ".html": "prettier --write",
    ".md": "prettier --write",
    ".py": "black",
    ".go": "gofmt -w",
    ".rs": "rustfmt",
    ".java": "google-java-format --replace",
    ".c": "clang-format -i",
    ".cpp": "clang-format -i",
    ".h": "clang-format -i"
  },
  "excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "*.min.css"
  ],
  "useProjectConfig": true,
  "failOnError": false,
  "showOutput": false
}
```

### Adding Custom Formatters

You can add custom formatters by modifying the configuration:

```json
{
  "formatters": {
    ".vue": "prettier --parser vue --write",
    ".php": "php-cs-fixer fix",
    ".rb": "rubocop -A"
  }
}
```

### Requirements
- Formatter tools installed (prettier, black, gofmt, etc.)
- Project configuration files (optional)

---

## 🔔 Notification Hook

**Purpose**: Enhanced notifications for Claude Code events with multiple delivery methods.

### Features
- **Cross-Platform Desktop Notifications**: Native notifications on Windows, macOS, Linux
- **Integration Support**: Slack, Discord, Microsoft Teams webhooks
- **Custom Commands**: Execute custom scripts on events
- **Event Types**: Task completion, errors, permission requests, idle states
- **Rich Content**: Formatted messages with context

### Notification Types

| Event Type | Default Title | When Triggered |
|------------|---------------|----------------|
| `task_completed` | "Claude Code Task Completed" | Task finishes successfully |
| `permission_required` | "Claude Code Permission Required" | Waiting for user permission |
| `error` | "Claude Code Error" | Error occurs during execution |
| `idle` | "Claude Code Idle" | Waiting for user input |

### Configuration

```json
{
  "desktopNotifications": true,
  "soundEnabled": false,
  "iconPath": "",
  "notificationTypes": {
    "task_completed": {
      "enabled": true,
      "title": "Claude Code Task Completed",
      "message": "Task has been completed successfully"
    },
    "permission_required": {
      "enabled": true,
      "title": "Claude Code Permission Required", 
      "message": "Claude Code is waiting for your permission"
    },
    "error": {
      "enabled": true,
      "title": "Claude Code Error",
      "message": "An error occurred during task execution"
    },
    "idle": {
      "enabled": false,
      "title": "Claude Code Idle",
      "message": "Claude Code is waiting for input"
    }
  },
  "integrations": {
    "slack": {
      "enabled": false,
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#general"
    },
    "discord": {
      "enabled": false,
      "webhook": "https://discord.com/api/webhooks/..."
    },
    "teams": {
      "enabled": false,
      "webhook": "https://outlook.office.com/webhook/..."
    }
  },
  "customCommands": {
    "onTaskCompleted": "",
    "onError": "echo 'Error occurred' >> /tmp/claude-errors.log",
    "onIdle": ""
  }
}
```

### Setting Up Integrations

#### Slack Integration
1. Create a Slack app at https://api.slack.com/apps
2. Add incoming webhook functionality
3. Copy the webhook URL to configuration
4. Set desired channel

#### Discord Integration
1. Go to your Discord server settings
2. Navigate to Integrations > Webhooks
3. Create a new webhook
4. Copy the webhook URL to configuration

#### Microsoft Teams Integration
1. Go to your Teams channel
2. Click "..." > Connectors
3. Add "Incoming Webhook" connector
4. Copy the webhook URL to configuration

### Custom Commands

Custom commands support template variables:

```json
{
  "customCommands": {
    "onTaskCompleted": "echo '{{title}}: {{message}}' | mail -s 'Claude Code Update' user@example.com",
    "onError": "logger -t claude-code 'Error: {{message}}'",
    "onIdle": "osascript -e 'display notification \"{{message}}\" with title \"{{title}}\"'"
  }
}
```

### Requirements
- **Desktop**: No additional requirements (fallback commands available)
- **node-notifier**: Optional, for enhanced desktop notifications (`npm install -g node-notifier`)
- **Integrations**: Valid webhook URLs for external services

---

## 🛠️ Creating Custom Hooks

You can create your own hooks by extending the `HookBase` class:

### Hook Template

```javascript
const HookBase = require('rins_hooks/src/hook-base');

class MyCustomHook extends HookBase {
  constructor(config = {}) {
    super('my-custom-hook', config);
  }

  getDefaultConfig() {
    return {
      enabled: true,
      matcher: "Edit|Write|MultiEdit",
      timeout: 60,
      description: "My custom hook description",
      // Add your custom config options here
    };
  }

  async execute(input) {
    try {
      const { tool_name, tool_input, session_id } = input;
      
      // Your hook logic here
      console.log(`Processing ${tool_name} tool with input:`, tool_input);
      
      // Return success
      return this.success({ 
        message: 'Hook executed successfully',
        data: { /* any additional data */ }
      });
      
    } catch (error) {
      return this.error(`Hook failed: ${error.message}`);
    }
  }

  // Optional: Add validation logic
  async validate() {
    // Add custom validation
    return super.validate();
  }
}

// Enable direct execution
if (require.main === module) {
  (async () => {
    try {
      const input = await HookBase.parseInput();
      const hook = new MyCustomHook();
      const result = await hook.execute(input);
      HookBase.outputResult(result);
    } catch (error) {
      console.error(`Hook error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = MyCustomHook;
```

### Hook Configuration File

Create a `config.json` file for your hook:

```json
{
  "name": "my-custom-hook",
  "description": "Description of what your hook does",
  "version": "1.0.0",
  "tags": ["custom", "example"],
  "requirements": ["git", "node"],
  "platforms": ["linux", "darwin", "win32"],
  "matcher": "Edit|Write|MultiEdit",
  "timeout": 60,
  "defaultConfig": {
    "enabled": true,
    "customOption": "default-value"
  }
}
```

### Hook Directory Structure

```
hooks/
└── my-custom-hook/
    ├── index.js      # Main hook implementation
    ├── config.json   # Hook metadata and configuration
    └── README.md     # Hook documentation (optional)
```

### Best Practices

1. **Error Handling**: Always wrap your logic in try-catch blocks
2. **Input Validation**: Check for required input fields
3. **Configuration**: Use the configuration system for customizable behavior
4. **Documentation**: Document your hook's purpose and configuration options
5. **Testing**: Test your hook across different platforms and scenarios
6. **Performance**: Keep hook execution time reasonable (under timeout)

### Hook Return Methods

- `this.success(data)`: Successful execution
- `this.error(message, data)`: Error occurred
- `this.block(reason)`: Block tool execution with reason
- `this.approve(reason)`: Approve tool execution (bypass permissions)

### Available Input Data

The input object contains:

```javascript
{
  session_id: string,           // Claude Code session ID
  transcript_path: string,      // Path to conversation transcript
  tool_name: string,           // Name of the tool being executed
  tool_input: {                // Tool-specific input data
    file_path: string,         // For file operations
    content: string,           // For Write operations
    old_string: string,        // For Edit operations
    new_string: string,        // For Edit operations
    // ... other tool-specific fields
  },
  tool_response: {             // Available in PostToolUse hooks
    success: boolean,
    // ... tool-specific response data
  }
}
```

This gives you complete context about what Claude Code is doing, allowing you to create powerful automation and integration hooks.