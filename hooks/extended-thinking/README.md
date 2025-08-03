# Extended Thinking Hook

The Extended Thinking hook provides a comprehensive system for enabling and controlling Claude's extended thinking capabilities through user-controlled toggles and explicit commands.

## Features

### 🧠 Auto-Mode (Toggleable)
- **Extended Thinking Toggle**: Automatically inject extended thinking instructions into every user prompt
- **Deep Thinking Toggle**: Automatically inject intensive deep analysis instructions into every user prompt
- **Priority System**: Deep thinking takes precedence over regular extended thinking when both are enabled

### 🎯 Explicit Commands (Slash Commands)
- `/think [prompt]` - Apply extended thinking to a specific prompt
- `/deep-think [prompt]` - Apply deep analytical thinking to a complex prompt
- `/think-toggle [on|off]` - Toggle extended thinking auto-mode
- `/deep-toggle [on|off]` - Toggle deep thinking auto-mode  
- `/think-status` - Show current thinking system status

## How It Works

### Automatic Mode
When thinking toggles are enabled, the hook intercepts `UserPromptSubmit` events and automatically injects thinking instructions as additional context. This happens transparently - users don't need to remember to add thinking instructions to their prompts.

### Manual Mode
Users can apply thinking explicitly to individual prompts using the slash commands, even when auto-mode is disabled.

### State Management
Toggle states are stored per-project in `.claude/extended-thinking-state.json`, allowing different thinking preferences for different projects.

## Installation

```bash
# Install the extended-thinking hook
npx rins_hooks install extended-thinking

# Or install interactively
npx rins_hooks install --interactive
```

## Usage Examples

### Enable Auto-Mode
```bash
# Enable extended thinking for all subsequent prompts
/think-toggle on

# Enable deep thinking for all subsequent prompts  
/deep-toggle on

# Check current status
/think-status
```

### Explicit Thinking
```bash
# Apply extended thinking to one prompt
/think How can I optimize this algorithm for better performance?

# Apply deep thinking to a complex problem
/deep-think Design a scalable microservices architecture for a global e-commerce platform with the following constraints: [complex requirements]
```

### Disable Auto-Mode
```bash
# Disable extended thinking auto-mode
/think-toggle off

# Disable deep thinking auto-mode
/deep-toggle off
```

## Thinking Modes

### Extended Thinking
Provides structured step-by-step reasoning:
1. **Analyze the Request**: Break down what's being asked
2. **Consider Context**: Evaluate relevant information  
3. **Plan Approach**: Determine the best methodology
4. **Think Through Implications**: Consider outcomes and consequences

### Deep Thinking
Provides comprehensive analytical thinking:
1. **Request Deconstruction**: Break down into fundamental components
2. **Context & Constraints Analysis**: Evaluate broader context and limitations
3. **Multiple Perspective Consideration**: Consider different viewpoints and approaches
4. **Solution Architecture**: Design optimal approaches with trade-off analysis
5. **Verification & Quality Check**: Validate reasoning and ensure completeness

## Configuration

### Project-Level Configuration
Thinking states are stored in your project's `.claude/extended-thinking-state.json`:

```json
{
  "thinkingToggle": false,
  "deepThinkingToggle": false,
  "lastModified": "2025-01-03T10:30:00.000Z"
}
```

### Hook Configuration
The hook is configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/rins_hooks/hooks/extended-thinking/index.js\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## Architecture

### Components
- **`index.js`**: Main hook implementation that intercepts UserPromptSubmit events
- **`state-manager.js`**: Manages toggle states and thinking prompt generation
- **`toggle-script.js`**: Handles toggle commands from slash commands
- **`status-script.js`**: Provides status information for slash commands
- **`commands/`**: Slash command definitions for explicit thinking control

### Event Flow
1. User submits a prompt
2. Hook intercepts `UserPromptSubmit` event
3. State manager checks current toggle states
4. If thinking is enabled, appropriate thinking instructions are injected as additional context
5. Claude processes the prompt with the thinking instructions
6. Response includes the extended thinking process

## Development

### Testing
```bash
# Run extended thinking hook tests
npm test -- extended-thinking.test.js

# Run with coverage
npm run test:coverage
```

### Debugging
Enable debug logging:
```bash
export THINKING_HOOK_DEBUG=1
# or
export CLAUDE_DEBUG=1
```

## API Reference

### ExtendedThinkingHook Class

#### Static Methods
- `getStatus(projectDir)` - Get current thinking status
- `toggleThinking(projectDir)` - Toggle extended thinking mode
- `toggleDeepThinking(projectDir)` - Toggle deep thinking mode  
- `getThinkingPrompt(type)` - Get thinking prompt for explicit use

### ThinkingStateManager Class

#### Methods
- `readState()` - Read current toggle states
- `writeState(state)` - Write toggle states to file
- `toggleThinking()` - Toggle thinking mode
- `toggleDeepThinking()` - Toggle deep thinking mode
- `getToggles()` - Get current toggle states
- `setToggle(type, value)` - Set specific toggle value
- `getThinkingPrompt()` - Get appropriate thinking prompt based on toggles
- `getStatus()` - Get comprehensive status information

## Troubleshooting

### Common Issues

**Thinking not being applied:**
- Check toggle status with `/think-status`
- Verify hook is installed: `npx rins_hooks status`
- Check Claude Code settings: `/hooks` command

**Toggle states not persisting:**
- Ensure `.claude` directory is writable
- Check file permissions on state file
- Verify project directory detection

**Commands not working:**
- Ensure slash commands are in `.claude/commands/` or `~/.claude/commands/`
- Check command file permissions
- Verify `CLAUDE_PROJECT_DIR` environment variable

### Debug Mode
Enable detailed logging to troubleshoot issues:
```bash
# Enable thinking hook debug mode
export THINKING_HOOK_DEBUG=1

# Or enable full Claude Code debug mode  
claude --debug
```

## Best Practices

### When to Use Extended Thinking
- Complex problem-solving tasks
- Multi-step analysis requirements
- Decision-making with multiple factors
- Code architecture and design questions

### When to Use Deep Thinking  
- Highly complex technical challenges
- Strategic planning and analysis
- Research and investigation tasks
- Critical decision-making with significant impact

### Performance Considerations
- Extended thinking increases response time but improves quality
- Deep thinking provides the most thorough analysis but takes longest
- Use auto-mode during intensive work sessions
- Use explicit commands for occasional deep analysis

### Token Management
- Thinking processes consume additional tokens
- Monitor usage in extended thinking sessions
- Consider token budgets for deep thinking mode
- Balance thinking depth with cost considerations

## Contributing

Contributions are welcome! Please:
1. Add tests for new features
2. Update documentation
3. Follow existing code style
4. Test with multiple thinking scenarios

## License

This hook is part of the rins_hooks collection and follows the same license terms.