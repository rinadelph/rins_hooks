#!/bin/bash

echo "Checking Claude processes..."
ps aux | grep -E "\bclaude\b" | grep -v grep | while read -r line; do
  pid=$(echo "$line" | awk '{print $2}')
  echo "PID $pid:"
  if [ -d "/proc/$pid" ]; then
    echo "  CWD: $(readlink /proc/$pid/cwd 2>/dev/null || echo 'unavailable')"
    echo "  CMD: $(cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' ' || echo 'unavailable')"
    echo "  ENV (Claude related):"
    cat /proc/$pid/environ 2>/dev/null | tr '\0' '\n' | grep -i claude || echo "    No Claude env vars"
  else
    echo "  Process no longer exists"
  fi
  echo
done