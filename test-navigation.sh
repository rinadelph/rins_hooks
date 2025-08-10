#!/bin/bash

# Test navigation to sessions section
# This simulates: Arrow right (5 times to get to Sessions) → Enter → Back → Quit

echo "Testing navigation to Sessions section..."

# Send: Right Right Right Right Right (to get to Sessions) Enter (to manage) Back (to exit) q (to quit)
echo -e "\e[C\e[C\e[C\e[C\e[C\r\e[D\rq" | timeout 10 node src/cli.js status

echo "Navigation test completed."