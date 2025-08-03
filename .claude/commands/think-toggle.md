---
description: Toggle extended thinking mode on/off for all subsequent prompts
argument-hint: [on|off] (optional)
model: sonnet
allowed-tools: Bash(node:*)
---

!`node "$CLAUDE_PROJECT_DIR/hooks/extended-thinking/toggle-script.js" thinking $ARGUMENTS`