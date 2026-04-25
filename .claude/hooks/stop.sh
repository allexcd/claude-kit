#!/bin/bash
# Stop hook for claude-workspace-kit.
# Surfaces open tasks/todo.md items and prompts for lessons capture at session end (§3, §4).
#
# Output on stdout is appended to the session context per Claude Code hook contract.
# Keep output small — it runs when an autonomous task completes (the agentic loop exits).

set -e

open=0
if [ -f tasks/todo.md ]; then
  open=$(grep -c '^- \[ \]' tasks/todo.md || true)
fi

entries=0
if [ -f tasks/lessons.md ]; then
  entries=$(awk '/^## Entries/{flag=1; next} flag' tasks/lessons.md | grep -c '^- Date:' || true)
fi

if [ "$open" -gt 0 ]; then
  echo "=== $open open item(s) remaining in tasks/todo.md ==="
  grep '^- \[ \]' tasks/todo.md
  echo ""
fi

if [ "$entries" -eq 0 ] && [ -f tasks/lessons.md ]; then
  echo "=== Reminder: tasks/lessons.md has no entries — capture any corrections before leaving. ==="
  echo ""
fi
