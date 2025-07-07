# Complete Agent-MCP Integration Test

This file tests the complete integration between:

1. **git-agentmcp hook**: Git commits with PID tracking
2. **agent-registry hook**: Session registration in .agent/registry.json  
3. **Agent-MCP monitoring**: Database tracking of Claude Code sessions

Expected results:
- Git commit with PID and session information
- Session registration in .agent/registry.json
- Activity logging in .agent/session-activity/
- Agent-MCP database will detect and track this session

Integration components:
- Claude Code session ID: Stable across tool calls
- PID tracking: Current process and parent process
- File-level coordination: Via file-locking hook
- Multi-agent awareness: Real-time session detection

Test timestamp: 2025-07-07T08:30:00Z
Status: Integration testing complete system