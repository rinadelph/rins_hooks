#!/bin/bash

# Tmux Bash Command Manager
# Creates dedicated tmux sessions for bash commands with auto-cleanup

CLAUDE_SESSION_NAME="claude-bash-$(date +%s)"
COMMAND_ARGS="$*"

# Create a dedicated tmux session for this command
tmux new-session -d -s "$CLAUDE_SESSION_NAME" 2>/dev/null || {
    echo "Failed to create tmux session"
    exit 1
}

# Create a new pane for this specific command
tmux new-window -t "$CLAUDE_SESSION_NAME" -n "cmd-$(date +%s)" bash -c "
    echo 'Running Claude Code command in dedicated tmux session'
    echo 'Session: $CLAUDE_SESSION_NAME'
    echo 'Command: $COMMAND_ARGS'
    echo '=================================='
    $COMMAND_ARGS
    echo '=================================='
    echo 'Command completed. This pane will close in 10 minutes...'
    sleep 600
    tmux kill-window
" 2>/dev/null

echo "✅ Command executed in tmux session: $CLAUDE_SESSION_NAME"
echo "💡 Use 'tmux attach -t $CLAUDE_SESSION_NAME' to view the session"
echo "⏰ Session will auto-close in 10 minutes"