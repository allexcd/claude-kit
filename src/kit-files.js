'use strict';

const MANAGED_FILES = [
  '.claude/settings.json',
  '.claude/agents/deep-reviewer.md',
  '.claude/agents/fast-implementer.md',
  '.claude/agents/codebase-explorer.md',
  '.claude/commands/kickoff.md',
  '.claude/commands/verify-and-close.md',
  '.claude/commands/elegant-fix.md',
  '.claude/commands/output-style.md',
  '.claude/commands/review.md',
  '.claude/skills/autonomous-bug-fixing/SKILL.md',
  '.claude/skills/demand-elegance/SKILL.md',
  '.claude/skills/plan-mode/SKILL.md',
  '.claude/skills/self-improvement/SKILL.md',
  '.claude/skills/subagent-strategy/SKILL.md',
  '.claude/skills/verification/SKILL.md',
  '.claude/rules/backend.md',
  '.claude/rules/frontend.md',
  '.claude/output-styles/terse.md',
  '.claude/output-styles/verbose.md',
  '.claude/hooks/session-start.sh',
  '.claude/hooks/stop.sh',
  'docs/workflow/workflow-orchestration.md',
];

const USER_FILES = ['CLAUDE.md', 'tasks/todo.md', 'tasks/lessons.md'];

const EXECUTABLE_FILES = [
  '.claude/hooks/session-start.sh',
  '.claude/hooks/stop.sh',
];

const INSTALL_FILES = [
  ...USER_FILES.map((filePath) => ({ path: filePath, ownership: 'user-owned' })),
  ...MANAGED_FILES.map((filePath) => ({ path: filePath, ownership: 'kit-managed' })),
];

module.exports = {
  EXECUTABLE_FILES,
  INSTALL_FILES,
  MANAGED_FILES,
  USER_FILES,
};
