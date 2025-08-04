# Claude Code Conversation Storage Analysis

*Analysis Date: August 4, 2025*  
*Test Directory: `/home/alejandro/Code/MCP/Hooks/Git/rins_hooks`*

## Executive Summary

Claude Code stores all conversations in a single monolithic JSON file (`~/.claude.json`) with project-based partitioning. Each directory you work in gets its own conversation thread, and the resume functionality (`claude -r`) provides access to all recent conversations across projects through an interactive selection interface.

## Primary Storage Location

### Main Database File
- **Location**: `/home/alejandro/.claude.json`
- **Size**: 13.9MB (as of test date)
- **Format**: JSON with very long lines (up to 63,953 characters)
- **Content**: All conversation data, settings, and metadata

### Supporting Directory Structure
```
~/.claude/
├── shell-snapshots/     # Terminal state snapshots
├── todos/              # Task tracking files  
├── projects/           # Project-specific metadata
├── sessions/           # Currently empty
├── settings.json       # User configuration
└── various backups and logs
```

## Data Structure

### JSON Schema Overview
```json
{
  "userID": "...",
  "projects": {
    "/path/to/project": {
      "history": [...],           // Conversation messages
      "lastSessionId": "...",     // Session identifier
      "allowedTools": [...],      // Permitted tools
      "lastTotalInputTokens": num,
      "lastTotalOutputTokens": num,
      // ... extensive metadata
    }
  },
  "sessions": {},               // Currently unused
  // ... global settings and metadata
}
```

### Conversation Storage Model
- **Per-project basis**: Each working directory maintains separate conversation history
- **Message format**: 
  ```json
  {
    "display": "visible message content",
    "pastedContents": {}  // attached/pasted content
  }
  ```
- **Current project statistics**: 100 messages in history for test directory

## Session Management System

### Atomic Write Operations
From debug output analysis:
```
[DEBUG] Writing to temp file: ~/.claude.json.tmp.[pid].[timestamp]
[DEBUG] Preserving file permissions: 100664
[DEBUG] Temp file written successfully, size: 13896946 bytes
[DEBUG] Applied original permissions to temp file
[DEBUG] Renaming temp file to ~/.claude.json
[DEBUG] File written atomically
```

### Shell Snapshots
- **Location**: `~/.claude/shell-snapshots/`
- **Format**: `snapshot-bash-[timestamp]-[id].sh`
- **Purpose**: Capture terminal state for context restoration
- **Size**: ~2KB per snapshot

### Todo Integration
- **Location**: `~/.claude/todos/`
- **Format**: `[uuid]-agent-[uuid].json`
- **Content**: Task tracking data (typically 2 bytes for empty tasks)

## Resume Functionality (`claude -r`)

### Interactive Session Selection
When running `claude -r`, Claude Code presents:

```
      Modified    Created     # Messages Git Branch     Summary
❯ 1. 1s ago      4m ago             100 testing        This session is being
  2. 2s ago      4m ago             146 testing        This session is being
  3. 5m ago      1h ago            1135 testing        This session is being
  4. 5m ago      12m ago           1159 testing        Claude Code Resume
  ...
  ↓ and 102 more…
```

### Session Metadata
- **Total available sessions**: 122+ across all projects
- **Display information**:
  - Last modified time
  - Creation time  
  - Message count
  - Git branch
  - Summary preview
- **Navigation**: Interactive selection with arrow keys

### Usage Limitations
- **Piped input error**: `--resume requires a valid session ID when used with --print`
- **Interactive requirement**: Must manually select session from interface
- **No direct session ID access**: Cannot programmatically resume specific sessions

## Project-Based Partitioning

### Current System Scale
- **Total projects tracked**: 61 directories
- **Project metadata includes**:
  - Conversation history
  - Tool permissions
  - MCP server configurations
  - Usage statistics (tokens, costs, duration)
  - Onboarding status
  - Trust settings

### Example Project Structure
```json
{
  "allowedTools": [],
  "history": [...],  // 100 messages for test project
  "dontCrawlDirectory": [...],
  "mcpContextUris": [...],
  "mcpServers": {...},
  "lastTotalInputTokens": num,
  "lastTotalOutputTokens": num,
  "lastSessionId": null
}
```

## Key Technical Findings

### Storage Strategy
1. **Monolithic approach**: Single JSON file for all data
2. **Atomic writes**: Prevents corruption during updates
3. **Project isolation**: Separate conversation threads per directory
4. **Rich metadata**: Extensive tracking of usage, costs, and context

### Performance Implications
- **File size**: 13.9MB for 61 projects
- **Write operations**: Full file rewrite for each update
- **Memory usage**: Entire file loaded into memory
- **Backup strategy**: Automatic backups in `~/.claude/`

### Security Considerations
- **File permissions**: 664 (readable by group)
- **Atomic operations**: Prevents partial write corruption
- **Backup retention**: Multiple timestamped backups maintained

## Recommendations

### For Users
1. **Backup regularly**: The `.claude.json` file contains all conversation history
2. **Monitor file size**: Large histories may impact performance
3. **Use project-based workflow**: Leverage directory-based conversation separation

### For Developers
1. **Consider database migration**: Large JSON files have scalability limits
2. **Implement cleanup tools**: Old conversations accumulate indefinitely
3. **Add export functionality**: Users may want conversation archives

## Test Methodology

This analysis was conducted using a comprehensive test script that captured:
- Debug output from `claude -r --debug`
- Session selection interface behavior
- File system operations during resume
- Multiple capture methods (script, tee, interactive simulation)

All findings are based on empirical observation of Claude Code behavior during resume operations and file system analysis of the storage structure.

---

*Generated from test results in `./test-logs/claude-resume-master-20250804_175244.log`*