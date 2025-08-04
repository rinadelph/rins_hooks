---
description: Generate Claude Code hook configuration from natural language description
argument-hint: "description of hook behavior"
allowed-tools: Bash(node:*)
---

🎣 **Rapala Hook Generator**

I'll generate a Claude Code hook configuration from your description: "$ARGUMENTS"

!`cd /home/alejandro/Code/MCP/Hooks/Git/rins_hooks && node src/hook-generator.js "$ARGUMENTS"`

The hook configuration above is ready to be added to your Claude Code settings.json file. You can:

1. **Copy the JSON configuration** from the output above
2. **Add it to your settings.json** in the appropriate hook section  
3. **Or use the Rapala management system** to install it through the interactive interface

💡 **Next steps:**
- Test the hook after installation
- Use `rapala status` to manage all your hooks
- Create more hooks by using `/rapala "another description"`