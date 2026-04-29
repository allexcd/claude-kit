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

This scaffolds kit files into your project and creates a `.cwk.lock` file to track versions, file ownership, and your selected git handling mode. Existing files are skipped unless you pass `--force`; skipped files that differ from the kit template are not claimed as kit-owned or added to the kit git block.

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

The installed `cwk` binary supports the same commands as the `npx claude-workspace-kit` examples. Direct `bash install.sh` installs are also supported for local clones; when Node.js is available, the script delegates to the same CLI lifecycle as `cwk`. Without Node.js, it uses a legacy scaffold-only fallback and prints a warning.

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

The Node CLI writes git exclusions as exact lock-tracked file paths inside a bounded Claude Code workflow kit block. Existing repository ignores stay untouched outside that block.

## Update

When a new kit version is published:

```bash
npx claude-workspace-kit@latest update
```

The update command uses a **file ownership model** to preserve your customizations:

| Tier | Behavior | Files |
|------|----------|-------|
| **Kit-managed** | Auto-updated to latest version | Skills, agents, commands, rules, hooks, settings, output styles, workflow docs |
| **User-owned** | Never overwritten by update | `CLAUDE.md`, `tasks/todo.md`, `tasks/lessons.md` |

`update` reuses the git handling mode saved during `init`. Older lockfiles without a saved mode prompt once in an interactive git repository; non-interactive old-lockfile updates still update files, but skip `.gitignore` / `.git/info/exclude` changes and print a warning.

When a new kit version adds files, missing kit-managed files are created and missing user-owned files are scaffolded once. Existing untracked paths are not overwritten unless `--force` is passed. Obsolete unmodified kit-managed files are removed, while obsolete locally modified files are kept but removed from tracking.

Preview changes without writing anything:

```bash
npx claude-workspace-kit@latest update --dry-run
```

## Release

Maintainers can prepare a release PR from `main`:

```bash
npm run release
```

The command checks for a clean working tree, asks for a patch/minor/major bump, creates a `release/vX.Y.Z` branch, updates `package.json` and `package-lock.json`, commits, pushes, and opens a PR. After that PR is merged, GitHub Actions creates the tag and GitHub Release, then publishes the package to npm with `NPM_TOKEN`.

## Uninstall

To remove all kit-installed files from your project:

```bash
npx claude-workspace-kit uninstall
```

By default this removes only **kit-managed** files and the `.cwk.lock` lockfile. **User-owned** files (`CLAUDE.md`, `tasks/`) are left untouched. Locally modified files selected for uninstall are kept unless `--force` is passed; if any modified files are kept, `.cwk.lock` is kept too.

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

During `--all`, locally modified user-owned files require confirmation before deletion. Non-interactive uninstall keeps modified user-owned files unless `--force` is passed.

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
| `cwk update --git-exclude` | Update and refresh paths in `.git/info/exclude` |
| `cwk update --gitignore` | Update and refresh paths in `.gitignore` |
| `cwk update --git-track` | Update without writing git ignore/exclude files |
| `cwk update --force` | Update even when files are locally modified |
| `cwk uninstall` | Remove kit-managed files and the lockfile |
| `cwk uninstall --all` | Also remove user-owned files (full cleanup) |
| `cwk uninstall --force` | Remove locally modified files selected for uninstall without prompting |
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
- `tasks/todo.md`, `tasks/lessons.md` — Used during development for planning and self-improvement

**Kit-managed files** receive upstream improvements automatically on `cwk update`. If you need to customize a skill, agent, command, or rule:

1. Create a *new* file alongside the kit version — e.g., `.claude/skills/my-workflow/SKILL.md` or `.claude/rules/my-project.md`
2. Leave kit-managed originals untouched so `update` continues to deliver improvements

This way your customizations live alongside the kit without conflicts.

## What's Included

### Agents

Specialist subagents dispatched with the `Agent` tool (`subagent_type: <name>`). Each runs in its own context window so it doesn't pollute the main conversation:

| Agent | Model | When to use | What it does |
|-------|-------|-------------|--------------|
| `deep-reviewer` | Opus | Before merging a non-trivial change or when an implementation feels uncertain | Reads the diff, challenges design choices, validates edge cases, and requires concrete proof (tests, logs, diffs) before approving — never rubber-stamps |
| `fast-implementer` | Sonnet | Once a plan is approved and ready to execute | Applies the plan with the smallest possible diff; fixes root causes only; verifies with tests or build output before reporting done |
| `codebase-explorer` | Sonnet | When mapping unfamiliar code or tracing where a symbol is defined and used | Read-only exploration — traces call paths, maps module dependencies, and finds all usages of a symbol without touching any files |

### Slash Commands

Invoked with `/<name>` inside a Claude Code session. Arguments are optional unless marked required:

| Command | What it does |
|---------|-------------|
| `/kickoff <task>` | Breaks the task into checkable steps, writes a plan to `tasks/todo.md` with a verification section, and presents it for approval — no code is written until the plan is confirmed |
| `/verify-and-close` | Runs tests, lint, and build; diffs behavior against the base branch; documents evidence in `tasks/todo.md`; blocks closure until proof is provided |
| `/elegant-fix` | Reviews the current implementation and asks "is there a more elegant way?" — proposes a cleaner solution when the answer is yes, skips the critique for simple obvious fixes |
| `/review [PR# or branch]` | Gets the diff (via `gh pr diff` for a PR number, or `git diff` for a branch), assesses correctness, security, quality, and test coverage, then outputs a confidence rating with blocking issues separated from suggestions |
| `/output-style <terse\|verbose>` | Reads the named style file (`.claude/output-styles/<name>.md`) and applies its response density and format rules for the rest of the session |

### Auto-Invoked Skills

Skills trigger automatically when Claude judges the task description matches — no slash command needed. They implement the core workflow disciplines from `docs/workflow/workflow-orchestration.md`:

| Skill | Triggers when | What it does |
|-------|--------------|--------------|
| `plan-mode` | Task has 3+ steps or involves an architectural decision | Writes a checkable plan to `tasks/todo.md` (steps + verification section) and presents it for approval before any code is written |
| `verification` | About to mark a task complete | Runs tests, lint, and build; diffs behavior; requires concrete evidence — never marks done by assertion alone |
| `demand-elegance` | A fix or implementation feels non-obvious or potentially hacky | Pauses to ask "is there a more elegant way?" and proposes a cleaner solution when warranted; skips for simple, obvious changes |
| `self-improvement` | After any user correction | Captures the mistake and a prevention rule in `tasks/lessons.md` so the same error is not repeated in future sessions |
| `subagent-strategy` | Research or parallel analysis would flood the main context window | Delegates work to specialist subagents and returns focused summaries; keeps the main session lean |
| `autonomous-bug-fixing` | Given a bug report, failing test, or error log | Diagnoses root cause, implements a minimal fix, and verifies without asking for hand-holding or context switching from the user |

### Rules

Path-scoped instruction files loaded automatically when Claude is working on matching files. Multiple rules can apply to the same file (e.g. both `backend.md` and `frontend.md` load for `.tsx` files):

| Rule file | Paths | What it enforces |
|-----------|-------|-----------------|
| `.claude/rules/backend.md` | `*.ts`, `*.js`, `*.py`, `*.go`, `*.java`, `*.cs`, `*.rb`, `*.rs` | Root-cause fixes only; minimal diffs; verify with tests, lint, and build before done; follow existing code style |
| `.claude/rules/frontend.md` | `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.scss`, `*.html` | Single-responsibility components; semantic HTML before ARIA; no inline styles; CSS variables over magic numbers; no preemptive memoization; keyboard accessibility |

### Output Styles

Activated with `/output-style <name>`. Styles are never auto-loaded — always user-triggered for the current session:

| Style | Best for | What changes |
|-------|---------|--------------|
| `terse` | Fast iteration, experienced users who know the codebase | No preambles or summaries; code diffs over prose; single-sentence status updates |
| `verbose` | Architecture reviews, onboarding, or explaining unfamiliar code | Reasoning shown before conclusions; step-by-step breakdowns; trade-offs and rejected alternatives surfaced |

### Hooks

Shell scripts registered in `.claude/settings.json` that run automatically at defined points in a session:

| Hook | Event | What it does |
|------|-------|--------------|
| `session-start.sh` | Start of every session | Reads `tasks/lessons.md` and `tasks/todo.md`; prints prior correction rules and open checklist items so Claude reviews them before starting new work |
| `stop.sh` | Agentic task completion | Prints any remaining open `tasks/todo.md` items; reminds to capture corrections in `tasks/lessons.md` if the file has no entries |

### File Ownership

| Category | Files | Ownership |
|---|---|---|
| Workflow rules | `docs/workflow/workflow-orchestration.md` | Kit-managed |
| Root instructions | `CLAUDE.md` | User-owned |
| Path-scoped rules | `.claude/rules/backend.md`, `.claude/rules/frontend.md` | Kit-managed |
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
- **`.claude/hooks/stop.sh`** — runs when an autonomous task completes (agentic task completion); reminds about open tasks and prompts for lesson capture if `tasks/lessons.md` has no entries.
- **`tasks/todo.md` + `tasks/lessons.md`** — canonical persisted plan and lesson log.
- **`~/.claude/projects/<project-slug>/memory/`** — personal cross-session memory, managed by Claude Code outside the repo. Use for user preferences, project context, and references that don't belong committed. Use `tasks/lessons.md` for anything team-shared.
- **`.cwk.lock`** — written by `npx claude-workspace-kit init`, read by `update` and `uninstall` to know which files are kit-managed vs user-owned and which git mode was selected.

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
