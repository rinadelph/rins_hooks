# Claude Code Hooks: Live Development Discovery

## Key Discovery: Hooks are Dynamically Executed

During development of the file-locking system, we discovered a crucial aspect of Claude Code hooks that enables rapid iteration and development.

## How Claude Code Hooks Actually Work

### Dynamic Execution Model
- **Fresh execution every time**: Each tool call spawns a new Node.js process running the hook script
- **No persistent state**: Each hook execution is completely independent 
- **Live code updates**: Changes to hook files take effect immediately on the next tool call
- **No restart required**: Hook modifications are applied instantly

### Execution Flow
```
Claude Code Tool Call → spawn new Node.js process → node index.js → Fresh code execution
```

### Development Implications

#### ✅ **Advantages for Development:**
1. **Real-time iteration**: Edit hook code and test immediately
2. **No deployment cycle**: Changes are live on next tool call
3. **Debug-friendly**: `console.error()` output appears in Claude Code feedback
4. **Risk-free experimentation**: Bad code only affects current tool call
5. **Version control friendly**: Hook changes can be tracked like any code

#### ⚠️ **Considerations:**
1. **No shared state**: Each execution starts fresh (use files/database for persistence)
2. **Performance overhead**: New process spawn for each tool call
3. **Error isolation**: Hook crashes don't affect Claude Code, but tool calls may fail

## Development Workflow Enabled

### Rapid Prototyping
```bash
# Edit hook logic
vim hooks/my-hook/index.js

# Test immediately - no restart needed
claude-code-tool-call  # Uses updated code instantly
```

### Live Debugging
```javascript
// Add debug output during development
console.error('DEBUG: Current state:', someVariable);
console.error('DEBUG: Input received:', JSON.stringify(input, null, 2));

// These appear in Claude Code's tool feedback immediately
```

### Iterative Refinement
1. Write initial hook logic
2. Test with real tool calls
3. See immediate feedback
4. Refine and test again
5. Repeat until perfect

## Real-World Example: File-Locking System Development

During our file-locking implementation, we:

1. **Started with basic PID-based agent identification**
2. **Discovered session identification issues through live testing**
3. **Added debug output to understand available data**
4. **Saw debug output immediately in tool feedback**
5. **Refined agent identification to use session_id**
6. **Tested lock creation/release cycle in real-time**
7. **Validated with actual multi-tool operations**

All of this happened through live editing and testing - no restarts, no deployment delays.

## Key Insights for Hook Development

### Available Data Sources
Hooks receive rich context from Claude Code:
```javascript
{
  "session_id": "3cb8f24a-24c7-4d9b-9470-ce20b2761893",
  "transcript_path": "/home/user/.claude/projects/...",
  "hook_event_name": "PreToolUse" | "PostToolUse" | "Notification",
  "tool_name": "Edit" | "Write" | "MultiEdit" | ...,
  "tool_input": { /* tool-specific parameters */ },
  "tool_response": { /* only available in PostToolUse */ }
}
```

### Process Context
- `process.pid`: Current hook process (changes every call)
- `process.ppid`: Parent Claude Code process (stable per session)  
- `process.env`: Environment variables from Claude Code
- `process.argv`: Command line arguments

### Session Identification Strategy
```javascript
function extractAgentId(input) {
  // Use stable session ID from Claude Code
  return input.session_id || `session-${process.ppid}`;
}
```

## Best Practices for Hook Development

### 1. **Use Debug Output Liberally**
```javascript
console.error('=== DEBUG ===');
console.error('Input:', JSON.stringify(input, null, 2));
console.error('Environment:', Object.keys(process.env));
console.error('=============');
```

### 2. **Handle Errors Gracefully**
```javascript
try {
  // Hook logic
} catch (error) {
  console.error(`Hook error: ${error.message}`);
  process.exit(1); // Non-blocking error
}
```

### 3. **Use Appropriate Exit Codes**
- `0`: Success, allow operation
- `2`: Block operation (PreToolUse only)
- `1`: Non-blocking error

### 4. **Test Incrementally**
- Start with minimal functionality
- Add features one at a time
- Test each change immediately
- Use real tool calls for validation

### 5. **Leverage Session Context**
- Use `session_id` for stable identification
- Use `hook_event_name` for phase detection
- Use `tool_name` and `tool_input` for context

## Conclusion

The dynamic execution model of Claude Code hooks enables a development experience similar to interpreted languages, where changes are immediately testable. This discovery transforms hook development from a traditional compile-deploy-test cycle into an interactive, iterative process that accelerates development and debugging.

**Key Takeaway**: Claude Code hooks are not just configuration files - they're live, dynamic code that can be developed and refined in real-time during actual usage.

---

*Discovered during file-locking system development, July 2025*