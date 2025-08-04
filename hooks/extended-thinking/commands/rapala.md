---
description: Generate Claude Code hook configuration from natural language description
argument-hint: "description of the hook behavior"
allowed-tools: Bash(node:*)
---

🎣 **Rapala Hook Generator**

Generating Claude Code hook configuration for: "{{prompt}}"

Let me generate the hook configuration:

```bash
cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks && node src/hook-generator.js "{{prompt}}"
```

This will create a Claude Code hook configuration that you can copy to your settings.json file.