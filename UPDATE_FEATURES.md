# 🔄 Automatic Update System

The rins_hooks system now includes comprehensive version management and automatic update checking.

## ✨ **New Features**

### 1. **Automatic Update Checks**
Every time you run any `rins_hooks` command, the system automatically checks for updates:

```bash
rins_hooks list    # Checks for updates before listing
rins_hooks status  # Checks for updates before showing status
```

**Update Notifications:**
```
┌────────────────────────────────────────┐
│  🔄 Hook Updates Available!           │
└────────────────────────────────────────┘

  ✨ notification 1.0.0 → 1.2.0
  🔧 task-blocker 1.0.0 → 1.0.1

💡 Run node hooks/version-checker/update.js check for details
💡 Run node hooks/version-checker/update.js update to update all
```

### 2. **Built-in Update Command**
New `rins_hooks update` command with multiple options:

```bash
# Check for updates
rins_hooks update --check
rins_hooks update -c

# Update all hooks
rins_hooks update --update
rins_hooks update -u

# Update specific hook
rins_hooks update --update extended-thinking
rins_hooks update -u task-blocker

# List all hooks with versions
rins_hooks update --list
rins_hooks update -l

# Reset version tracking
rins_hooks update --reset
rins_hooks update -r
```

### 3. **Version Checker Hook**
The `version-checker` hook runs on every Claude Code session start:

- **SessionStart Event**: Automatically checks for updates when Claude Code starts
- **Version Registry**: Maintains `.claude/hook-versions.json` with version history
- **Smart Notifications**: Only shows updates in Claude Code context when new versions are detected

### 4. **Update Types**
The system recognizes different update types:

| Type | Emoji | Description | Example |
|------|-------|-------------|---------|
| **New** | 🆕 | First time installing | `none → 1.0.0` |
| **Major** | 🚀 | Breaking changes | `1.x.x → 2.0.0` |
| **Minor** | ✨ | New features | `1.0.x → 1.1.0` |
| **Patch** | 🔧 | Bug fixes | `1.0.0 → 1.0.1` |

### 5. **Smart Update Checking**
- **Interval-based**: Only checks every 6 hours to avoid spam
- **Context-aware**: Only checks when in directories with installed hooks  
- **Silent failures**: Never interrupts main commands if update check fails
- **Timestamp tracking**: Maintains last check time in version registry

## 🔧 **Technical Implementation**

### Version Registry Structure
```json
{
  "hooks": {
    "extended-thinking": {
      "version": "2.0.0",
      "lastChecked": "2025-08-04T17:26:56.154Z",
      "path": "/path/to/hooks/extended-thinking"
    }
  },
  "lastChecked": "2025-08-04T17:26:56.154Z",
  "lastUpdateCheck": "2025-08-04T17:27:33.330Z",
  "checkInterval": 21600000,
  "settings": {
    "autoUpdate": false,
    "notifyUpdates": true
  }
}
```

### Update Detection Logic
1. **Hook Discovery**: Scans `hooks/` directory for `config.json` files
2. **Version Comparison**: Uses semantic versioning comparison
3. **Update Classification**: Determines major/minor/patch/new updates
4. **Notification Generation**: Creates context-appropriate messages

### CLI Integration
- **preAction Hook**: Runs before any CLI command
- **Error Handling**: Fails silently to not interrupt main functionality
- **Performance**: Lightweight checks with caching

## 🚀 **Usage Examples**

### Daily Workflow
```bash
# Morning: Check status (auto-checks for updates)
rins_hooks status

# See notification about available updates
# Update specific hook
rins_hooks update -u extended-thinking

# Or update everything
rins_hooks update -u
```

### Version Management
```bash
# List all hooks with current versions
rins_hooks update --list

# Check what updates are available
rins_hooks update --check

# Reset version tracking (fresh start)
rins_hooks update --reset
```

### Claude Code Integration
When you start Claude Code, the SessionStart hook will:
1. Check all installed hooks for version updates
2. Report available updates in context
3. Provide update commands for easy access

## 🔒 **Security & Reliability**

- **Non-intrusive**: Update checks never block or interrupt main functionality
- **Safe defaults**: Auto-update disabled by default
- **Error isolation**: Update check failures don't affect hook functionality
- **Version validation**: Semantic version parsing with fallbacks
- **Path safety**: Validates hook paths and prevents directory traversal

## 📊 **Benefits**

1. **Always Up-to-date**: Automatic notifications about available updates
2. **Easy Management**: Simple commands for version management
3. **Context Awareness**: Updates shown when and where they matter
4. **Version History**: Complete tracking of hook versions over time
5. **Zero Maintenance**: Automatic checking with smart intervals

The update system ensures your hooks are always current while never getting in the way of your workflow!