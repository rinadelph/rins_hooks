# Hook Development Notes

## Key Understanding: Hook Execution Logic

### Immediate Changes (No Restart Required)
When Claude Code executes a hook, it runs a fresh process:
```bash
node "/path/to/hook/index.js"
```

**✅ These changes take effect IMMEDIATELY:**
- Editing hook script files (`.js` files in `/hooks/`)
- Fixing bugs in hook logic
- Adding new features to existing hooks
- Changing hook behavior/functionality
- Modifying commit messages, staging logic, etc.

**Why:** Each hook execution is a brand new Node.js process that reads the current file content.

### Restart Required Changes
**❌ These changes require Claude Code restart:**
- Adding/removing hooks from settings.json
- Changing which events trigger hooks (PostToolUse → PreToolUse)
- Modifying hook matchers ("Edit|Write" → "Edit|Write|MultiEdit")
- Enabling/disabling hooks
- Changing hook timeouts or other configuration

**Why:** Hook registration and configuration is loaded once at Claude Code startup.

## Practical Implications

### During Development
- ✅ **Edit hook files freely** - changes work immediately
- ✅ **Test fixes by triggering tools** - no restart needed
- ✅ **Debug and iterate quickly** - instant feedback

### During Configuration
- ❌ **Settings.json changes need restart** - configuration is cached
- ✅ **Use `/hooks` CLI command** - changes apply immediately without restart
- ⚠️ **Manual settings edits** - require restart to take effect

## Recent Examples

### Git Hook Staging Fix
When we fixed the git hook staging issue:
1. **Modified** `hooks/git-agentmcp/index.js` staging logic
2. **Tested** immediately with Edit command
3. **Worked** without any restart - fresh Node.js execution picked up changes

### Dynamic Test Confirmation
To prove our understanding, we ran a live test:
1. **Added dynamic-test hook to settings.json** → Required restart (didn't run)
2. **Modified debug-git hook script** → Added "🧪 DYNAMIC TEST: Code changes take effect immediately! v2.0"
3. **Triggered Edit operation** → Hook immediately showed new message

**Result:** The modified debug-git hook output:
```
🔍 Git Debug Hook - Issues After Tool Execution:
🧪 DYNAMIC TEST: Code changes take effect immediately! v2.0
```

This definitively proves code changes work immediately while config changes need restart.

## Best Practices
1. **Develop hooks** by editing the `.js` files directly
2. **Configure hooks** using the `/hooks` CLI command when possible
3. **Test changes** by triggering the relevant tool/event
4. **Remember**: Code changes = immediate, config changes = restart