# Claude Workspace Kit

[![CI](https://github.com/allexcd/claude-workspace-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/allexcd/claude-workspace-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-workspace-kit)](https://www.npmjs.com/package/claude-workspace-kit)
[![npm downloads](https://img.shields.io/npm/dm/claude-workspace-kit)](https://www.npmjs.com/package/claude-workspace-kit)
[![License: MIT](https://img.shields.io/npm/l/claude-workspace-kit)](LICENSE)
[![Node.js >=20](https://img.shields.io/node/v/claude-workspace-kit)](https://www.npmjs.com/package/claude-workspace-kit)
[![GitHub stars](https://img.shields.io/github/stars/allexcd/claude-workspace-kit?style=social)](https://github.com/allexcd/claude-workspace-kit)

A workflow orchestration kit for Claude Code. Structured rules, agents, skills, and slash commands that make Claude plan before building, verify before closing, and self-improve after corrections.

## Install

Run this inside your project directory:

```bash
npx claude-workspace-kit init
```

This scaffolds all kit files into your project and creates a `.cwk.lock` file to track versions.

The installer is **interactive** and walks you through three steps:

1. **Git handling** — choose how the installed files are tracked or excluded in git
2. **Commit** — optionally stage and commit the files (only when choosing to track in git)
3. **Project context** — optionally run `/init` inside Claude Code to append codebase-specific context to `CLAUDE.md`

### Project context via `/init`

At the end of the install, the installer offers to launch Claude Code automatically:

```
  Add project-specific context via /init? [y/N]
```

If you accept, Claude Code opens with restricted tools. Type `/init` and Claude scans your codebase — entry points, folder structure, naming conventions — and appends a summary to `CLAUDE.md`. Type `/exit` when done.

This is non-destructive: existing `CLAUDE.md` content is never overwritten. You can also run it later manually:

```bash
claude  # then type /init inside the session
```

## Git Handling

If you are in a git repository, the installer prompts you to choose how git should handle the installed files:

```
  [1] Exclude locally   — write to .git/info/exclude (your clone only)
  [2] Add to .gitignore — shared with the team via .gitignore
  [3] Track in git      — commit the files with the repo
```

You can skip the prompt by passing a flag directly:

```bash
npx claude-workspace-kit init --git-exclude  # local-only exclusion via .git/info/exclude
npx claude-workspace-kit init --gitignore    # append to .gitignore (shared with the team)
npx claude-workspace-kit init --git-track    # no exclusion — commit the files with the repo
```

If you chose `--git-track`, the installer prompts whether to commit immediately. If you are on `main` or `master`, it also suggests creating a feature branch first:

```
  Suggested: chore/add-claude-workspace-kit
```

To commit manually later:

```bash
git add CLAUDE.md .claude/ docs/workflow/ tasks/todo.md tasks/lessons.md .cwk.lock
git commit -m "chore: add claude devkit"
```

Non-interactive installs (e.g. CI, piped scripts) default to `--git-exclude` and skip both the commit and `/init` prompts. A tip is printed at the end with manual instructions.

## Update

When a new kit version is published:

```bash
npx claude-workspace-kit@latest update
```

The update command uses a **file ownership model** to preserve your customizations:

| Tier | Behavior | Files |
|------|----------|-------|
| **Kit-managed** | Auto-updated to latest version | Skills, agents, commands, hooks, settings, output styles, workflow docs |
| **User-owned** | Never overwritten by update | `CLAUDE.md`, `.claude/rules/*.md`, `tasks/todo.md`, `tasks/lessons.md` |

Preview changes without writing anything:

```bash
npx claude-workspace-kit@latest update --dry-run
```

## Uninstall

To remove all kit-installed files from your project:

```bash
npx claude-workspace-kit uninstall
```

By default this removes only **kit-managed** files and the `.cwk.lock` lockfile. **User-owned** files (`CLAUDE.md`, `.claude/rules/`, `tasks/`) are left untouched.

To remove everything — including user-owned files:

```bash
npx claude-workspace-kit uninstall --all
```

Preview what would be removed without deleting anything:

```bash
npx claude-workspace-kit uninstall --dry-run
npx claude-workspace-kit uninstall --all --dry-run
```

Empty directories left behind after file removal are cleaned up automatically. Directories that still contain other files are preserved. Git exclusion entries added by the kit (in `.git/info/exclude` or `.gitignore`) are also removed.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `cwk init` | Interactive install — scaffolds all kit files |
| `cwk init --git-exclude` | Scaffold and write installed paths to `.git/info/exclude` (local only) |
| `cwk init --gitignore` | Scaffold and append installed paths to `.gitignore` |
| `cwk init --git-track` | Scaffold only — no git exclusion, commit files with the repo |
| `cwk init --force` | Re-scaffold all files, overwriting any existing ones |
| `cwk update` | Update kit-managed files to the latest version |
| `cwk update --dry-run` | Preview updates without writing any files |
| `cwk uninstall` | Remove kit-managed files and the lockfile |
| `cwk uninstall --all` | Also remove user-owned files (full cleanup) |
| `cwk uninstall --dry-run` | Preview what would be removed without deleting |

The installed binary is available as `cwk`, but one-shot `npx` commands must use the package name: `npx claude-workspace-kit ...`.

### Claude Code slash commands

These run inside a Claude Code session (not in the terminal):

| Command | Purpose |
|---------|---------|
| `/init` | Scan the codebase and append a project summary to `CLAUDE.md` |
| `/kickoff <task>` | Plan-first task launch — writes a checkable plan to `tasks/todo.md` before any implementation |
| `/verify-and-close` | Verification checklist before marking a task done — requires concrete proof |
| `/elegant-fix` | Elegance review of the current implementation — proposes a cleaner solution when something feels hacky |
| `/review [PR# or branch]` | Review current branch diff or a specified PR — rates confidence and separates blockers from suggestions |
| `/output-style <terse\|verbose>` | Switch output style for this session |

## Customizing the Kit

**User-owned files** are yours to modify freely. They are scaffolded once and never touched by `update`:

- `CLAUDE.md` — Add project-specific rules and context (use `/init` to populate automatically)
- `.claude/rules/backend.md` — Adapt to your backend language, framework, or coding standards
- `.claude/rules/frontend.md` — Adapt to your frontend framework, styling system, or component patterns
- `tasks/todo.md`, `tasks/lessons.md` — Used during development for planning and self-improvement

**Kit-managed files** receive upstream improvements automatically. If you need to customize a skill, agent, or command:

1. Create a *new* file alongside the kit version (e.g., `.claude/skills/my-custom-skill/SKILL.md`)
2. Leave kit-managed originals untouched so `update` continues to work

This way your customizations live alongside the kit without conflicts.

## What's Included

### Agents

Specialist subagents dispatched with the `Agent` tool (`subagent_type: <name>`):

| Agent | Model | Purpose |
|-------|-------|---------|
| `deep-reviewer` | Opus | Architecture and quality review — challenges elegance, validates edge cases, requires proof |
| `fast-implementer` | Sonnet | Executes an approved plan with minimal diff — root-cause fixes only |
| `codebase-explorer` | Sonnet | Read-only structural exploration — traces call paths, maps dependencies, finds symbol usages |

### Slash Commands

Invoked with `/<name>` inside a Claude Code session:

| Command | Purpose |
|---------|---------|
| `/kickoff <task>` | Plan-first task launch — writes a checkable plan to `tasks/todo.md` before any implementation |
| `/verify-and-close` | Verification checklist — requires concrete proof before closing a task |
| `/elegant-fix` | Elegance review — proposes a cleaner solution when the current fix feels hacky |
| `/review [PR# or branch]` | Code review — rates confidence and separates blockers from suggestions |
| `/output-style <terse\|verbose>` | Switch output style for this session |

### Auto-Invoked Skills

Triggered automatically when Claude judges the task description matches — no slash command needed:

| Skill | When it fires |
|-------|--------------|
| `plan-mode` | Any task with 3+ steps or architectural decisions |
| `verification` | Before marking any task complete |
| `demand-elegance` | When a fix or implementation feels non-obvious |
| `self-improvement` | After any user correction |
| `subagent-strategy` | When research or parallel analysis would clutter main context |
| `autonomous-bug-fixing` | When given a bug report, failing test, or error log |

### Rules

Path-scoped instruction files loaded automatically when Claude works on matching files:

| Rule file | Paths covered | Purpose |
|-----------|--------------|---------|
| `.claude/rules/backend.md` | `*.ts`, `*.js`, `*.py`, `*.go`, `*.java`, `*.cs`, `*.rb`, `*.rs` | General code quality — root-cause fixes, minimal diffs, test-driven verification |
| `.claude/rules/frontend.md` | `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.scss`, `*.html` | Frontend standards — component responsibility, accessibility, CSS, performance |

### Output Styles

Switched with `/output-style <name>`:

| Style | When to use |
|-------|------------|
| `terse` | Default — compact, high-signal. No preambles, code diffs over prose |
| `verbose` | Architecture reviews, onboarding, explaining unfamiliar code — full reasoning shown |

### Hooks

Shell scripts registered in `settings.json` that run automatically:

| Hook | Event | Purpose |
|------|-------|---------|
| `session-start.sh` | Session start | Surfaces open `tasks/todo.md` items and prior `tasks/lessons.md` lessons |
| `stop.sh` | Session end | Reminds about open tasks and uncaptured lessons |

### File Ownership

| Category | Files | Ownership |
|---|---|---|
| Workflow rules | `docs/workflow/workflow-orchestration.md` | Kit-managed |
| Root instructions | `CLAUDE.md` | User-owned |
| Path-scoped rules | `.claude/rules/backend.md`, `.claude/rules/frontend.md` | User-owned |
| Agents | `.claude/agents/*.md` | Kit-managed |
| Slash commands | `.claude/commands/*.md` | Kit-managed |
| Skills | `.claude/skills/*/SKILL.md` | Kit-managed |
| Settings | `.claude/settings.json` | Kit-managed |
| Hooks | `.claude/hooks/*.sh` | Kit-managed |
| Output styles | `.claude/output-styles/*.md` | Kit-managed |
| Task tracking | `tasks/todo.md`, `tasks/lessons.md` | User-owned |
| Memory | `~/.claude/projects/<project-slug>/memory/` | Outside repo — auto-loaded by Claude Code |
| Lock file | `.cwk.lock` | Kit-managed |

## How It Fits Together

- **`CLAUDE.md`** — loaded into every Claude Code session as system context.
- **`.claude/rules/`** — loaded only when Claude works on files matching the `paths:` globs in each rule file. Multiple rules can match the same file (e.g. both `backend.md` and `frontend.md` apply to `.tsx` files).
- **`.claude/agents/`** — subagents callable via the Agent tool (`subagent_type: deep-reviewer`).
- **`.claude/commands/`** — slash commands invokable with `/<name>` (e.g. `/kickoff Add OAuth`).
- **`.claude/skills/`** — auto-invoked when Claude judges the task description matches the skill.
- **`.claude/output-styles/`** — output style files applied via `/output-style <name>`. They define rules for response density and format — not auto-loaded, always user-triggered.
- **`.claude/settings.json`** — defines which tools run without prompting and registers hooks.
- **`.claude/hooks/session-start.sh`** — runs at the start of every session; surfaces open `tasks/todo.md` items and prior `tasks/lessons.md` corrections so Claude reviews them before new work.
- **`.claude/hooks/stop.sh`** — runs at the end of every session; reminds about open tasks and prompts for lesson capture if `tasks/lessons.md` is empty.
- **`tasks/todo.md` + `tasks/lessons.md`** — canonical persisted plan and lesson log.
- **`~/.claude/projects/<project-slug>/memory/`** — personal cross-session memory, managed by Claude Code outside the repo. Use for user preferences, project context, and references that don't belong committed. Use `tasks/lessons.md` for anything team-shared.
- **`.cwk.lock`** — written by `npx claude-workspace-kit init`, read by `update` and `uninstall` to know which files are kit-managed vs user-owned.

## Compatibility

Uses Claude Code's native loader paths:
- `CLAUDE.md` (root instructions)
- `.claude/settings.json` (permissions, hooks)
- `.claude/agents/*.md` (subagents)
- `.claude/commands/*.md` (slash commands)
- `.claude/skills/*/SKILL.md` (auto-invoked skills)
- `.claude/rules/*.md` (path-scoped modular instructions)
- `.claude/output-styles/*.md` (output styles)
- `.claude/hooks/*` (executable hooks referenced from settings.json)

## Complementary Tools

**[graphify](https://github.com/safishamsi/graphify)** — Reduces LLM input tokens by building a knowledge graph from your codebase (code, docs, PDFs, images, video). Agents navigate by graph structure instead of scanning raw files — 71× fewer tokens per query on large corpora.

## Contributing

To contribute, create a branch and open a PR targeting `main`. At least one approval is required before merging. Approvals are dismissed on any new push, requiring re-review.

### Commit Types

| Type | When to use |
|------|-------------|
| `feat` | Adding a new feature or capability |
| `fix` | Fixing a bug or broken behavior |
| `chore` | Maintenance, configuration, or tooling — no production code change |
| `docs` | Documentation only — no code changes |
| `refactor` | Restructuring code without changing its external behavior |
| `test` | Adding, updating, or fixing tests |
| `perf` | A change that improves performance |
| `ci` | Changes to CI/CD configuration or pipeline |
| `build` | Changes that affect the build system or dependencies |
| `revert` | Reverting a previous commit |
| `hotfix` | Urgent fix that needs to go out immediately |

### Branch Names

Branches must follow this pattern:

```
<type>/<short-description>
```

Rules:
- Lowercase and hyphens only — no uppercase, no underscores, no spaces
- Description must be between 2 and 5 words
- Keep it descriptive enough to understand at a glance

Examples:
```
feat/add-oauth-login
fix/token-expiry-crash
chore/update-deps
docs/improve-readme
refactor/simplify-update-logic
test/add-status-unit-tests
hotfix/fix-broken-publish
```

### PR Titles

Pull request titles must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): [TICKET-123] - <short description>
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | Yes | `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `revert` |
| `(scope)` | No | e.g. `(auth)`, `(cli)` — the area of the codebase affected |
| `[TICKET-123]` | No | Your issue or ticket reference |
| `short description` | Yes | Lowercase, no trailing period, imperative tense |

Rules:
- Description must be lowercase and must not end with a period
- Total title must be 72 characters or fewer
- Use imperative tense: "add feature", not "added feature"

Examples:
```
feat(auth): [PROJ-123] - add oauth login with google
fix(cli): handle missing lock file on update
chore(deps): bump eslint to 10.2.0
docs(readme): update contributing section
```

### Commit Messages

Commit messages follow the same format as PR titles:

```
<type>(<scope>): [TICKET-123] - <short description>

Optional body explaining WHY the change was made, if not obvious.
```

Rules:
- Subject line: 50 characters or fewer
- Body: add only when the why is not obvious — wrap at 72 characters
- Separate subject and body with a blank line
- Use imperative tense in the subject

### Merging Rules

| Rule | When enforced |
|------|--------------|
| Branch name pattern | On `git push` — push rejected immediately |
| PR title format | On PR open/edit — CI check blocks merge |
| Lint | On PR open + every new commit — CI check blocks merge |
| Tests (Node 20, 22, 24) | On PR open + every new commit — CI check blocks merge |
| Build / pack check | On PR open + every new commit — CI check blocks merge |
| 1 approval required | At merge time |
| Stale approval on new push | At merge time — approval dismissed, re-review required |
| No direct push to main | On `git push` — push rejected immediately |

