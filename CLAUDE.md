# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## About This Repo

`claude-workspace-kit` is an installer kit — a set of files that users copy into their own projects via `install.sh`. The files in this repo are the *source of truth* for those installs:

- **`install.sh`** — copies kit files into a target project directory; never run from inside this repo
- **`CLAUDE.md`** — gets installed into target projects; also applies when developing the kit itself
- **`.claude/`** — agents, commands, hooks, rules, settings, skills, and output styles (all installed)
- **`docs/workflow/workflow-orchestration.md`** — the core methodology document (installed)
- **`tasks/todo.md` / `tasks/lessons.md`** — plan tracking and self-improvement log (installed as empty templates)

To test the installer locally, run it against a scratch project: `mkdir /tmp/scratch-proj && cd /tmp/scratch-proj && git init && node /path/to/claude-workspace-kit/bin/cwk.js init --git-exclude`.

---

## Workflow

Follow the workflow orchestration defined in `docs/workflow/workflow-orchestration.md`.

## Mandatory Behaviors
- **Plan first** for non-trivial tasks (3+ steps or architectural decisions). Write the plan to `tasks/todo.md` and mirror steps into TaskCreate so progress is visible.
- **Verify before done** with concrete proof — tests, logs, diffs, or behavioral checks.
- **Demand elegance** for non-trivial changes. Skip for simple, obvious fixes.
- **Self-improve** after any correction — update `tasks/lessons.md` with a prevention rule.
- **Use subagents** to keep the main context clean. One task per subagent.
- **Fix bugs autonomously** — don't ask for hand-holding. Diagnose, fix, prove.

## Task Tracking
- Track progress in `tasks/todo.md` with checkable items. Mirror items into TaskCreate/TaskUpdate.
- After any correction, update `tasks/lessons.md`.
- Review `tasks/lessons.md` at session start (surfaced automatically by the SessionStart hook).

## Memory
Claude Code maintains a persistent memory store at `~/.claude/projects/<project-slug>/memory/` — outside the repo, never committed, loaded into every session automatically.

Use the right layer for each concern:
- **`tasks/lessons.md`** — correction rules the whole team benefits from (committed, reviewable, shared via git)
- **memory** — personal preferences, user context, project facts that don't belong in the repo

What to save to memory:
- User profile: role, expertise, communication preferences
- Feedback: how the user wants you to work (confirmed approaches and corrections)
- Project context: decisions, constraints, deadlines not derivable from code or git history
- References: where to find things in external systems (Linear, Grafana, Slack, etc.)

Never duplicate between the two layers. If a correction is team-relevant, it goes in `tasks/lessons.md`. If it's personal or ephemeral, it goes in memory.

## Output Contract (non-trivial tasks)
1. Plan
2. Implementation summary
3. Verification evidence
4. Risks / follow-ups

## Core Principles
- **Simplicity First**: Every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. Avoid introducing bugs.

## Available Specialist Agents
- `deep-reviewer` — architecture and quality review; challenges elegance, validates edge cases, requires proof.
- `fast-implementer` — executes an approved plan with minimal diff; root-cause fixes only.
- `codebase-explorer` — fast, read-only exploration; traces call paths, maps structure, finds symbol usages.

Dispatch with the Agent tool (`subagent_type: deep-reviewer` / `fast-implementer` / `codebase-explorer`). See `.claude/skills/subagent-strategy/SKILL.md`.

## Available Slash Commands
- `/kickoff <task>` — plan-first launch for a new task.
- `/verify-and-close` — verification checklist before marking a task done.
- `/elegant-fix` — elegance review of the current implementation.
- `/review [PR# or branch]` — review current branch diff or a specified PR.
- `/output-style <terse|verbose>` — switch output style for this session.

## Auto-Invoked Skills
These trigger automatically when Claude judges the description matches the task — no slash command needed:
- `plan-mode` — enters plan mode for non-trivial tasks.
- `verification` — enforces proof-before-done discipline.
- `demand-elegance` — challenges non-obvious implementations.
- `self-improvement` — captures corrections into `tasks/lessons.md`.
- `subagent-strategy` — delegates research and parallel analysis to subagents.
- `autonomous-bug-fixing` — diagnoses and fixes bugs without hand-holding.
