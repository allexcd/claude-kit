#!/bin/bash
# SessionStart hook for claude-kit.
# Surfaces tasks/lessons.md and open tasks/todo.md items at session start
# so Claude reviews prior corrections before beginning new work (§3).
#
# Output on stdout is appended to the session context per Claude Code hook contract.
# Keep output small — it lands in every session.

set -e

if [ -f tasks/lessons.md ]; then
  entries=$(awk '/^## Entries/{flag=1; next} flag' tasks/lessons.md | grep -c '^- Date:' || true)
  if [ "$entries" -gt 0 ]; then
    echo "=== Lessons from prior sessions (tasks/lessons.md) ==="
    awk '/^## Entries/{flag=1; next} flag' tasks/lessons.md
    echo ""
  fi
fi

if [ -f tasks/todo.md ]; then
  open=$(grep -c '^- \[ \]' tasks/todo.md || true)
  if [ "$open" -gt 0 ]; then
    echo "=== Open items in tasks/todo.md ($open) ==="
    grep '^- \[ \]' tasks/todo.md
    echo ""
  fi
fi
