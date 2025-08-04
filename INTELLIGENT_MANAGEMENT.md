# 🧠 Intelligent Hook Management System

The rins_hooks system now includes sophisticated coordination to prevent duplicate hook executions and manage conflicts intelligently.

## 🚀 **Key Features**

### 1. **Smart Hook Coordination System**
Intelligently manages hook execution based on hook type and event:

```javascript
// Automatically coordinates hook execution with smart logic
const coordination = new HookCoordination(projectDir);
const operationId = coordination.generateOperationId(input);

// Smart coordination: thinking hooks can run multiple times, others are strictly controlled
if (coordination.shouldRun('extended-thinking', eventType, operationId)) {
  // Execute hook logic
  coordination.markComplete('extended-thinking', eventType, operationId);
}
```

**Smart Coordination Features:**
- **Thinking Hook Flexibility**: Hooks with "thinking" in name can run after every tool call
- **UserPromptSubmit Protection**: Prevents duplicate processing of same user prompt
- **Tool Event Freedom**: PreToolUse/PostToolUse allowed for thinking hooks with spam prevention
- **Strict Control**: Non-thinking hooks (like git-agentmcp) use strict duplicate prevention
- **Operation ID Generation**: Creates appropriate IDs based on event type and content
- **Lock Files**: Uses `.claude/hook-locks/` directory for coordination
- **Timeout Protection**: Automatically cleans up stale locks (5-second timeout for most, 1-second for thinking)

### 2. **Intelligent Configuration Cleaning**
New `rins_hooks clean` command removes duplicates and optimizes configuration:

```bash
# Clean user-level hooks
rins_hooks clean --user

# Clean all levels with statistics
rins_hooks clean --all --stats --validate

# Clean and show optimization results
rins_hooks clean --user --validate
```

**Cleaning Process:**
- **Duplicate Removal**: Eliminates identical hook commands
- **Matcher Merging**: Combines hooks with same matchers
- **Conflict Resolution**: Handles overlapping functionality
- **Validation**: Checks for missing files and configuration issues

### 3. **Hook Statistics & Monitoring**
Track hook usage and performance:

```bash
# Show hook statistics
rins_hooks clean --stats

# Validate configuration
rins_hooks clean --validate
```

**Statistics Include:**
- Total events, matchers, and hooks
- Hooks per event type
- Active coordination locks
- Configuration validation results

### 4. **Smart Installation**
Hooks are installed with conflict detection:

```javascript
// Intelligent installation with conflict resolution
await hookManager.installHookIntelligently(
  'extended-thinking', 
  ['UserPromptSubmit', 'PreToolUse', 'PostToolUse'],
  { scope: 'user', matcher: '', timeout: 30 }
);
```

**Installation Features:**
- **Conflict Detection**: Identifies duplicate and overlapping hooks
- **Auto-Resolution**: Automatically resolves common conflicts
- **Cleanup Integration**: Runs optimization after installation

## 🔧 **Technical Implementation**

### Coordination Lock System
```
.claude/
├── hook-locks/
│   ├── extended-thinking-UserPromptSubmit-abc123.lock
│   ├── extended-thinking-PreToolUse-def456.lock
│   └── git-agentmcp-PostToolUse-ghi789.lock
└── extended-thinking-state.json
```

**Lock File Structure:**
```json
{
  "hookName": "extended-thinking",
  "eventType": "UserPromptSubmit", 
  "operationId": "test123-Read-abc-1754330000",
  "timestamp": 1754330000000,
  "pid": 12345
}
```

### Operation ID Generation
Operation IDs are created from:
- **Session ID** (last 8 characters)
- **Tool Name** (if applicable)
- **Content Hash** (prompt or tool input)
- **Timestamp** (last 6 digits for uniqueness)

Example: `test123-Read-a1b2c3-330000`

### Hook Configuration Optimization
**Before Cleaning:**
```json
{
  "UserPromptSubmit": [
    { "matcher": "", "hooks": [{"command": "hook1"}] },
    { "matcher": "", "hooks": [{"command": "hook1"}] }, // Duplicate
    { "matcher": "", "hooks": [{"command": "hook2"}] }
  ]
}
```

**After Cleaning:**
```json
{
  "UserPromptSubmit": [
    { 
      "matcher": "", 
      "hooks": [
        {"command": "hook1"},
        {"command": "hook2"}
      ]
    }
  ]
}
```

## 📊 **Current Clean Configuration**

After optimization, your configuration now has:

```json
{
  "SessionStart": [
    { "hooks": [{ "command": "version-checker" }] }
  ],
  "UserPromptSubmit": [
    { "hooks": [{ "command": "extended-thinking" }] }
  ],
  "PreToolUse": [
    { "hooks": [{ "command": "extended-thinking" }] }
  ],
  "PostToolUse": [
    { 
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [
        { "command": "git-agentmcp" },
        { "command": "extended-thinking" }
      ]
    }
  ]
}
```

**Key Improvements:**
- ✅ **No Duplicates**: Each hook runs only once per operation
- ✅ **Intelligent Coordination**: Lock system prevents race conditions  
- ✅ **Optimized Matchers**: Efficient event matching
- ✅ **Clean Structure**: Organized and maintainable configuration

## 🛡️ **Protection Mechanisms**

### 1. **Duplicate Prevention**
- Same hook won't execute multiple times for identical operations
- Lock files prevent race conditions between parallel executions
- Automatic cleanup of stale locks

### 2. **Error Handling**
- Coordination failures don't block hook execution (fail-open)
- Graceful degradation if lock system unavailable
- Automatic recovery from corrupted lock files

### 3. **Performance Optimization**
- Minimal overhead from coordination system
- Efficient operation ID generation
- Smart cleanup of old coordination data

## 🎯 **Benefits**

1. **No More Duplicates**: Extended thinking hook runs exactly once per operation
2. **Better Performance**: Eliminates redundant hook executions
3. **Cleaner Logs**: No more duplicate debug messages
4. **Reliable Coordination**: Prevents race conditions in multi-hook scenarios
5. **Easy Management**: Simple commands to clean and optimize configuration
6. **Smart Installation**: Automatic conflict detection and resolution

## 🚀 **Usage Examples**

### Managing Hook Configuration
```bash
# Check current status
rins_hooks status

# Clean up duplicates and conflicts  
rins_hooks clean --user --stats

# Validate configuration
rins_hooks clean --validate

# Install new hook with intelligence
rins_hooks install notification --user
```

### Monitoring Hook Coordination
```bash
# Check coordination statistics
node -e "
const coord = require('./hooks/extended-thinking/coordination');
console.log(new coord('.').getStats());
"
```

The intelligent management system ensures your hooks work efficiently together without conflicts or duplicates!