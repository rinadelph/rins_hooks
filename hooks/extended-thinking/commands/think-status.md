---
description: Show current status of thinking toggles and modes
model: sonnet
allowed-tools: Bash(node:*)
---

## Current Extended Thinking Status

!`node "$CLAUDE_PROJECT_DIR/hooks/extended-thinking/status-script.js"`

Use `/think-toggle` or `/deep-toggle` to change these settings.
Use `/think` or `/deep-think` for one-time thinking on specific prompts.