# Conversation Saver Hook

Archives Claude Code conversations to the `.agent/conversations/` directory with comprehensive metadata and organization.

## Overview

This hook automatically captures and archives Claude Code conversation files, preserving complete conversation history within your project's `.agent` directory. It integrates seamlessly with the existing session tracking and registry systems.

## Features

- **Automatic Archival**: Archives conversations when sessions end
- **Metadata Preservation**: Maintains detailed metadata about each conversation
- **Project Integration**: Works with existing `.agent` registry and session tracking
- **Organized Storage**: Structured directory layout for easy navigation
- **Activity Logging**: Logs all archival activities to session-activity JSONL

## Architecture

### Storage Structure
```
.agent/conversations/
├── active/           # Currently active conversations
├── archived/         # Archived conversation files
└── metadata/         # Metadata and summary files
```

### Integration Points
- Uses `.agent/registry.json` for session tracking
- Logs to `.agent/session-activity/conversation-saver.jsonl`
- Follows established path encoding patterns
- Compatible with existing hook ecosystem

## Installation

### 1. Manual Installation
```bash
# Test the hook
node hooks/conversation-saver/index.js

# Add to Claude Code settings.json
```

### 2. Hook Configuration
Add to your `~/.claude/settings.json`:

```json
{
  "SessionEnd": [{
    "hooks": [{
      "type": "command",
      "command": "node \"/path/to/rins_hooks/hooks/conversation-saver/index.js\"",
      "timeout": 30
    }]
  }],
  "ManualTrigger": [{
    "hooks": [{
      "type": "command", 
      "command": "node \"/path/to/rins_hooks/hooks/conversation-saver/index.js\"",
      "timeout": 30
    }]
  }]
}
```

## Usage

### Automatic Mode
The hook automatically triggers when:
- Claude Code sessions end
- Session cleanup occurs
- Registry timeout events happen

### Manual Mode
```bash
# Archive current project conversations
node hooks/conversation-saver/index.js

# View archived conversations
ls .agent/conversations/archived/

# Check archival activity
tail .agent/session-activity/conversation-saver.jsonl
```

## Output Files

### Archived Conversations
- **Location**: `.agent/conversations/archived/`
- **Format**: `YYYY-MM-DD_[original-filename].jsonl`
- **Content**: Complete conversation files from `~/.claude/projects/`

### Metadata Files
- **Location**: `.agent/conversations/metadata/`
- **Format**: `[archived-filename].meta.json`
- **Content**: 
  ```json
  {
    "original_path": "/path/to/original",
    "archived_at": "2025-08-05T...",
    "file_type": "conversation|summary",
    "file_size": 1234567,
    "session_info": {...},
    "project_path": "/working/directory"
  }
  ```

### Activity Logs
- **Location**: `.agent/session-activity/conversation-saver.jsonl`
- **Format**: JSONL with timestamps and action details

## Configuration Options

Edit `hooks/conversation-saver/config.json`:

```json
{
  "settings": {
    "auto_archive": true,           // Enable automatic archival
    "archive_on_session_end": true, // Archive when sessions end
    "max_file_size_mb": 50,        // Skip files larger than this
    "retention_days": 365,         // How long to keep archives
    "include_metadata": true,      // Generate metadata files
    "compress_archives": false     // Compress archived files
  }
}
```

## Integration with Existing Systems

### Registry Integration
- Reads current session info from `.agent/registry.json`
- Uses session tracking for conversation identification
- Follows established session management patterns

### Activity Logging
- Extends existing session-activity logging
- Compatible with debug-hook and registry-activity formats
- Maintains JSONL format consistency

### Path Encoding
- Uses proven path encoding: `/home/user/project` → `-home-user-project`
- Compatible with Claude Code's project organization
- Preserves directory structure mapping

## Troubleshooting

### Common Issues

**No conversations found:**
```bash
# Check if Claude Code conversations exist
ls ~/.claude/projects/-home-*-rins_hooks/

# Verify registry has session info
cat .agent/registry.json
```

**Permission errors:**
```bash
# Ensure .agent directory is writable
ls -la .agent/
chmod 755 .agent/conversations/
```

**Hook not triggering:**
```bash
# Test manual execution
node hooks/conversation-saver/index.js

# Check Claude Code settings.json installation
```

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG_CONVERSATION_SAVER=1 node hooks/conversation-saver/index.js
```

## Architecture Details

### File Discovery Process
1. Read current session from `.agent/registry.json`
2. Encode project path using established pattern
3. Search `~/.claude/projects/[encoded-path]/` for JSONL files
4. Classify files by size (summary vs. conversation)
5. Archive files with metadata preservation

### Session Integration
- Leverages existing session tracking infrastructure
- Preserves session context and metadata
- Maintains conversation threading information
- Compatible with project-based conversation organization

### Error Handling
- Graceful degradation when registry unavailable
- Comprehensive error logging to activity JSONL
- Safe file operations with existence checks
- Timeout protection for large file operations

## Future Enhancements

- **Search Interface**: Query archived conversations by content
- **Compression**: Optional gzip compression for space savings
- **Retention Management**: Automatic cleanup of old archives
- **Export Formats**: Export to markdown, PDF, or other formats
- **Conversation Analysis**: Statistics and insights from archived conversations

## Related Hooks

- **conversation-titler**: Updates conversation titles (works together)
- **agent-registry**: Session tracking and management
- **extended-thinking**: Enhanced conversation context
- **git-agentmcp**: Git integration for conversation versioning