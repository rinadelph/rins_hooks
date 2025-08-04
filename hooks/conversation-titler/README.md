# 🏷️ Conversation Titler Hook

**Purpose**: Automatically generates meaningful conversation titles instead of generic "This session is being continued from a previous conversation" titles.

## Overview

This hook leverages our discovered Claude Code architecture to intelligently update conversation titles in the JSONL summary files located in `~/.claude/projects/`. Instead of seeing generic resumed conversation titles, you'll get meaningful titles that reflect what you're actually working on.

## Features

- **Smart Title Generation**: Analyzes tool usage and context to create meaningful titles
- **Category-Based Templates**: Different title formats for code, git, analysis, and other activities  
- **Emoji Support**: Optional emoji prefixes for visual categorization
- **File-Aware**: Incorporates file names and extensions into titles
- **Project Context**: Uses project directory and detected language for better context
- **Automatic Updates**: Works seamlessly with Claude Code's conversation system

## How It Works

Based on our research into Claude Code's dual storage architecture:

1. **Detects Tool Activity**: Monitors file edits, bash commands, analysis tools, etc.
2. **Finds Summary Files**: Locates the appropriate JSONL summary file in `~/.claude/projects/`
3. **Analyzes Context**: Examines tool inputs, file paths, and project structure
4. **Generates Title**: Creates meaningful title using category-specific templates
5. **Updates JSONL**: Directly modifies the summary file (leveraging our proven manipulation capability)

## Title Categories

| Category | Template | Example |
|----------|----------|---------|
| **Code** | `💻 Code: {{summary}}` | "💻 Code: Modified config.js" |
| **Git** | `🔄 Git: {{summary}}` | "🔄 Git: commit" |
| **Analysis** | `🔍 Analysis: {{summary}}` | "🔍 Analysis: Search: TODO" |
| **Debug** | `🐛 Debug: {{summary}}` | "🐛 Debug: Python tests" |
| **Docs** | `📝 Docs: {{summary}}` | "📝 Docs: Created README.md" |
| **Config** | `⚙️ Config: {{summary}}` | "⚙️ Config: package.json" |

## Configuration

```json
{
  "enabled": true,
  "titleLength": 60,
  "includeEmoji": true,
  "blacklistPatterns": [
    "This session is being continued",
    "Claude Code conversation",
    "Resumed conversation"
  ],
  "titleTemplates": {
    "code": "💻 Code: {{summary}}",
    "analysis": "🔍 Analysis: {{summary}}",
    "debug": "🐛 Debug: {{summary}}",
    "git": "🔄 Git: {{summary}}",
    "docs": "📝 Docs: {{summary}}",
    "config": "⚙️ Config: {{summary}}",
    "default": "{{emoji}} {{summary}}"
  }
}
```

### Configuration Options

- **`titleLength`**: Maximum characters for generated titles (default: 60)
- **`includeEmoji`**: Whether to include emoji prefixes (default: true)
- **`blacklistPatterns`**: Patterns that indicate generic titles needing replacement
- **`titleTemplates`**: Template strings for different activity categories

## Installation

```bash
# Install the conversation titler hook
rins_hooks install conversation-titler

# Install at different scopes
rins_hooks install conversation-titler --user    # Global
rins_hooks install conversation-titler --project # Project-wide
rins_hooks install conversation-titler --local   # Local only
```

## Title Generation Logic

### Code Activities (Edit, Write, MultiEdit)
- **File modifications**: "Modified filename.ext"
- **New files**: "Created filename.ext" 
- **General edits**: "Edited .ext file"

### Git Operations (Bash with git commands)
- **Commits**: "Git commit"
- **Pushes**: "Git push"
- **Status checks**: "Git status check"
- **Diffs**: "Git diff review"

### Analysis Activities (Read, Grep, Glob)
- **Pattern searches**: "Search: pattern"
- **File analysis**: "Analyzed filename.ext"
- **General**: "Code analysis"

### Shell Commands (Bash)
- **NPM/Yarn**: "NPM operation", "Yarn operation"
- **Docker**: "Docker operation"
- **Tests**: "Python tests", "JavaScript tests"
- **Build**: "Rust build", "Build process"

## Technical Implementation

This hook works by:

1. **Leveraging Discovered Architecture**: Uses our mapped Claude Code conversation storage system
2. **Project Path Encoding**: Converts paths using Claude's encoding pattern (`/home/user/project` → `-home-user-project`)
3. **JSONL File Detection**: Finds summary files by size and content analysis
4. **Direct File Modification**: Updates conversation titles using proven text manipulation techniques
5. **Context Analysis**: Examines project structure, git status, and file types

## Architecture Integration

Based on our comprehensive Claude Code architecture analysis:

```
Claude Code Session
        ↓
Tool Execution (Edit, Bash, etc.)
        ↓  
conversation-titler Hook Triggered
        ↓
Analyze: tool_name + tool_input + context
        ↓
Locate: ~/.claude/projects/encoded-path/summary.jsonl
        ↓
Generate: Category-based meaningful title
        ↓
Update: JSONL summary file directly
        ↓
Result: Next `claude -r` shows meaningful title
```

## Examples

### Before (Generic Titles)
```
1. This session is being continued from a previo...
2. This session is being continued from a previo...  
3. This session is being continued from a previo...
```

### After (Meaningful Titles)
```  
1. 💻 Code: Modified package.json
2. 🔄 Git: commit changes
3. 🔍 Analysis: Search: TODO
```

## Troubleshooting

### Hook Not Triggering
- Check hook installation: `rins_hooks status`
- Verify matcher pattern includes your tool usage
- Review hook logs for errors

### Titles Not Updating
- Ensure write permissions to `~/.claude/projects/`
- Check if summary files exist in expected location
- Verify JSONL file format is valid

### Generic Titles Still Showing
- Confirm blacklist patterns match your generic titles
- Check if title generation logic handles your use case
- Consider customizing title templates

## Requirements

- **Node.js**: For hook execution
- **File System Access**: Read/write permissions to `~/.claude/` directory
- **Claude Code**: Compatible with v1.0.67+ (tested version)

## Security & Safety

This hook:
- ✅ Only modifies conversation title summaries (non-destructive)
- ✅ Uses atomic file operations where possible
- ✅ Validates JSON structure before modification
- ✅ Creates backups via Claude Code's normal operation
- ❌ Does not modify conversation message content
- ❌ Does not access external networks or services

---

*Built on our comprehensive Claude Code architecture research and proven conversation manipulation capabilities*