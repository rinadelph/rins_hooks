# Claude Code Tool Analysis & Hook Behavior

## Summary of Findings

Based on reverse engineering Claude Code internals using [kirshatrov.com/posts/claude-code-internals](https://kirshatrov.com/posts/claude-code-internals) and comprehensive testing, here are our key discoveries:

## Tool Hook Trigger Patterns

### ✅ Tools That Trigger PostToolUse Hooks
- **Write**: Each file write operation triggers hooks separately
- **Edit**: Single edits trigger one hook execution  
- **MultiEdit**: Multiple edits in one operation trigger ONE hook execution
- **Read**: Does NOT trigger PostToolUse hooks with our current matcher

### ❌ Tools That Do NOT Trigger Hooks (with Edit|Write|MultiEdit matcher)
- **Bash**: Command execution does not match our hook pattern
- **Read**: File reading operations don't trigger PostToolUse
- **Glob**: File pattern matching operations
- **LS**: Directory listing operations

## BatchTool Behavior

**Key Discovery**: Claude Code's BatchTool decomposes batch operations into individual tool calls.

### Evidence:
1. **Read + Edit in one message** → 2 separate hook triggers (only Edit triggered due to matcher)
2. **Multiple Write operations** → Each Write triggered a separate hook
3. **MultiEdit with multiple changes** → Single hook trigger (treated as one operation)

### Pattern:
```
User Request: "Read file X and edit it"
↓
Claude Code BatchTool decomposes to:
1. Read(file_X) → No hook (doesn't match pattern)  
2. Edit(file_X) → Hook triggered
```

## Git Commit Evidence

Our auto-commit hooks created the following pattern:
```bash
f72b20e Auto-commit: MultiEdit modified test-edit.js      # 1 commit for MultiEdit
d5ee73e Auto-commit: Write modified batch-c.txt          # 3 separate commits
9ed638f Auto-commit: Write modified batch-b.txt          # for 3 Write operations
499466f Auto-commit: Write modified batch-a.txt          # in one message
a2ac919 Auto-commit: Edit modified test-multiedit.json   # Edit after Read
29971a7 Auto-commit: Edit modified test-edit.js          # Single Edit
b073ab1 Auto-commit: Write modified single-write-test.txt # Single Write
```

## Tool Architecture Insights

### Core Claude Code Tools (from blog analysis):
- `dispatch_agent`: Launches sub-agents with additional tools
- `Bash`: Executes commands with security checks  
- `BatchTool`: Runs multiple tool invocations in parallel
- `GlobTool`: Matches file patterns
- `View`: Reads local filesystem files
- `Edit`: Modifies existing files
- `Write`: Creates new files
- `MultiEdit`: Makes multiple edits to one file

### Hook Integration Points:
1. **Individual Tools**: Each tool call can trigger PreToolUse/PostToolUse hooks
2. **Matcher Patterns**: Hooks only trigger for tools matching the regex pattern
3. **Batch Decomposition**: BatchTool breaks down into individual tool calls
4. **Security Layer**: Bash commands go through multiple security checks before execution

## /compact Command Analysis

**Finding**: The `/compact` command likely does NOT trigger hooks because:
1. It's an internal Claude Code command, not a tool call
2. Internal commands bypass the tool invocation system
3. Only actual tool calls (Write, Edit, Bash, etc.) trigger hook events

### Testing Strategy for Internal Commands:
- Internal commands like `/compact` don't go through the tool system
- Memory management tools (like in the Anthropic notebook) that ARE implemented as proper tools WILL trigger hooks
- The distinction is: built-in commands vs. tool implementations

## Practical Implications

### For Hook Development:
1. **Tool-specific hooks**: Design hooks for specific tool types using matchers
2. **Batch awareness**: Expect individual hook calls for batch operations  
3. **Selective triggering**: Use precise matchers to avoid unwanted hook executions
4. **Performance**: Each tool call = potential hook execution, design efficiently

### For Memory Management:
1. **CompactifyMemory as a tool**: Would trigger hooks if implemented as a proper tool
2. **Built-in /compact**: Does not trigger hooks (internal command)
3. **Custom memory tools**: Can integrate with hooks for tracking and automation

## Reverse Engineering Methodology

1. **Blog analysis**: Used technical insights from Claude Code internals
2. **Systematic testing**: Created controlled test scenarios
3. **Git commit tracking**: Used auto-commits as hook execution evidence  
4. **Tool pattern analysis**: Identified BatchTool decomposition behavior
5. **Matcher validation**: Confirmed regex pattern behavior

## Recommendations

1. **Hook Matchers**: Use specific patterns like `Edit|Write|MultiEdit` for file operations
2. **Batch Handling**: Design hooks to handle decomposed batch operations
3. **Tool Coverage**: Add matchers for other tools (Bash, Read) if needed
4. **Internal Commands**: Don't expect hooks for `/` commands - implement as tools instead
5. **Performance**: Consider hook execution overhead for high-frequency tools

---

*Generated through systematic testing and reverse engineering of Claude Code tool architecture*