#!/bin/bash
set -e

# claude-workspace-kit installer
# Usage (from your project directory):
#   bash <path-to-cloned-kit>/install.sh [--force] [--git-exclude|--gitignore|--git-track]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$(pwd)"

if [ "$SCRIPT_DIR" = "$TARGET_DIR" ]; then
  echo "  ERROR: Run this from your project directory, not from inside the kit repo." >&2
  echo "         cd /your/project && bash $SCRIPT_DIR/install.sh" >&2
  exit 1
fi

if command -v node &>/dev/null; then
  exec node "$SCRIPT_DIR/bin/cwk.js" init "$@"
fi

echo "  WARNING: node was not found; using legacy bash fallback."
echo "           Update/uninstall lifecycle features require Node.js or npx."
echo ""

FORCE=0
GIT_MODE=""   # "exclude" | "gitignore" | "track" | ""

for arg in "$@"; do
  case "$arg" in
    --force|-f)    FORCE=1 ;;
    --git-exclude) GIT_MODE="exclude" ;;
    --gitignore)   GIT_MODE="gitignore" ;;
    --git-track)   GIT_MODE="track" ;;
  esac
done

KIT_FILES=(
  "CLAUDE.md"
  ".claude/settings.json"
  ".claude/agents/deep-reviewer.md"
  ".claude/agents/fast-implementer.md"
  ".claude/agents/codebase-explorer.md"
  ".claude/commands/kickoff.md"
  ".claude/commands/verify-and-close.md"
  ".claude/commands/elegant-fix.md"
  ".claude/commands/output-style.md"
  ".claude/commands/review.md"
  ".claude/skills/autonomous-bug-fixing/SKILL.md"
  ".claude/skills/demand-elegance/SKILL.md"
  ".claude/skills/plan-mode/SKILL.md"
  ".claude/skills/self-improvement/SKILL.md"
  ".claude/skills/subagent-strategy/SKILL.md"
  ".claude/skills/verification/SKILL.md"
  ".claude/rules/backend.md"
  ".claude/rules/frontend.md"
  ".claude/output-styles/terse.md"
  ".claude/output-styles/verbose.md"
  ".claude/hooks/session-start.sh"
  ".claude/hooks/stop.sh"
  "docs/workflow/workflow-orchestration.md"
  "tasks/todo.md"
  "tasks/lessons.md"
)

EXECUTABLE_FILES=(
  ".claude/hooks/session-start.sh"
  ".claude/hooks/stop.sh"
)

installed=0
skipped=0

echo ""
echo "  claude-workspace-kit installer"
echo "  ===================="
echo ""

for file in "${KIT_FILES[@]}"; do
  target="${TARGET_DIR}/${file}"
  source="${SCRIPT_DIR}/${file}"

  if [ ! -f "$source" ]; then
    echo "  ✗     ${file}  (not found in kit)"
    continue
  fi

  if [ -f "$target" ] && [ "$FORCE" -eq 0 ]; then
    echo "  skip  ${file}  (exists)"
    skipped=$((skipped + 1))
    continue
  fi

  mkdir -p "$(dirname "$target")"
  cp "$source" "$target"
  echo "  ✓     ${file}"
  installed=$((installed + 1))
done

for file in "${EXECUTABLE_FILES[@]}"; do
  if [ -f "${TARGET_DIR}/${file}" ]; then
    chmod +x "${TARGET_DIR}/${file}"
  fi
done

# ── git handling ──────────────────────────────────────────────────────────────

_git_exclude() {
  local exclude="${TARGET_DIR}/.git/info/exclude"
  local marker="# Claude Code workflow kit"
  if grep -qF "$marker" "$exclude" 2>/dev/null; then
    echo "  skip  .git/info/exclude  (entries already present)"
    skipped=$((skipped + 1))
  else
    printf '\n# Claude Code workflow kit — personal dev tooling\nCLAUDE.md\n.claude/\ndocs/workflow/\ntasks/todo.md\ntasks/lessons.md\n.cwk.lock\n' >> "$exclude"
    echo "  ✓     .git/info/exclude  (entries appended)"
    installed=$((installed + 1))
  fi
}

_git_gitignore() {
  local gitignore="${TARGET_DIR}/.gitignore"
  local marker="# Claude Code workflow kit"
  if grep -qF "$marker" "$gitignore" 2>/dev/null; then
    echo "  skip  .gitignore  (entries already present)"
    skipped=$((skipped + 1))
  else
    printf '\n# Claude Code workflow kit\nCLAUDE.md\n.claude/\ndocs/workflow/\ntasks/todo.md\ntasks/lessons.md\n.cwk.lock\n' >> "$gitignore"
    echo "  ✓     .gitignore  (entries appended)"
    installed=$((installed + 1))
  fi
}

if git -C "$TARGET_DIR" rev-parse --git-dir &>/dev/null 2>&1; then
  if [ -z "$GIT_MODE" ]; then
    if [ ! -t 0 ]; then
      GIT_MODE="exclude"
      echo "  Non-interactive install: defaulting to local-only exclusion (.git/info/exclude)"
    else
      echo ""
      echo "  How should git handle the installed files?"
      echo "    [1] Exclude locally   — write to .git/info/exclude (your clone only)"
      echo "    [2] Add to .gitignore — shared with the team via .gitignore"
      echo "    [3] Track in git      — commit the files with the repo"
      read -r -p "  Choice [1]: " _git_choice || true
      case "${_git_choice:-1}" in
        2) GIT_MODE="gitignore" ;;
        3) GIT_MODE="track" ;;
        *) GIT_MODE="exclude" ;;
      esac
    fi
  fi

  case "$GIT_MODE" in
    exclude)   _git_exclude ;;
    gitignore) _git_gitignore ;;
    track)     echo "  ✓     git tracking enabled — files will be committed with the repo" ;;
  esac
else
  echo "  skip  git setup  (not a git repo)"
fi

echo ""
echo "  Done: ${installed} installed, ${skipped} skipped"
if [ "$skipped" -gt 0 ] && [ "$FORCE" -eq 0 ]; then
  echo "  Run with --force to overwrite existing files"
fi
echo ""

# ── commit scaffolded files (only when tracking in git) ───────────────────────

if [ "$GIT_MODE" = "track" ]; then
  _do_commit=0

  if [ ! -t 0 ]; then
    echo "  Non-interactive install with --git-track: skipping commit prompt."
    echo "  Stage and commit the installed files manually."
    echo ""
  else
    echo "  Would you like to commit the installed files? [y/N]"
    read -r _commit_resp || true
    [[ "${_commit_resp:-}" =~ ^[Yy]$ ]] && _do_commit=1
    echo ""
  fi

  if [ "$_do_commit" -eq 1 ]; then
    _last=$(git -C "$TARGET_DIR" log --format="%s" -1 2>/dev/null || echo "")
    if echo "$_last" | grep -qE '^[a-z]+(\(.+\))?: '; then
      _default_msg="chore: add claude workspace kit"
    else
      _default_msg="Add claude workspace kit"
    fi

    _branch=$(git -C "$TARGET_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ "$_branch" == "main" || "$_branch" == "master" ]]; then
      echo "  You're on '${_branch}'. Create a feature branch? [y/N]"
      echo "  Suggested: chore/add-claude-workspace-kit"
      read -r _branch_resp || true
      if [[ "${_branch_resp:-}" =~ ^[Yy]$ ]]; then
        read -r -p "  Branch name [chore/add-claude-workspace-kit]: " _branch_name || true
        git -C "$TARGET_DIR" checkout -b "${_branch_name:-chore/add-claude-workspace-kit}"
        echo ""
      fi
    fi

    echo "  Commit message: $_default_msg"
    read -r -p "  Press Enter to accept or type a custom message: " _custom_msg || true
    _commit_msg="${_custom_msg:-$_default_msg}"

    git -C "$TARGET_DIR" add CLAUDE.md .claude/ docs/workflow/ tasks/todo.md tasks/lessons.md 2>/dev/null || true
    git -C "$TARGET_DIR" commit -m "$_commit_msg"
    echo "  ✓     committed"
    echo ""
  fi
fi

# ── optional: add project context via /init ───────────────────────────────────

_run_init() {
  echo "  Launching Claude Code — type /init to generate CLAUDE.md, then /exit when done"
  echo ""
  claude --allowedTools "Read,Write,Glob,Grep,Bash(git log:git status:git branch:find:ls)"
  echo ""
  echo "  Done. CLAUDE.md updated with project context."
}

_print_manual_init() {
  echo ""
  echo "  To add project context later:"
  echo "    1. npm install -g @anthropic-ai/claude-code   (if not installed)"
  echo "    2. Run: claude"
  echo "    3. Type: /init"
  echo ""
}

echo "  ── Optional: add project context ────────────────────────────────────"
echo "  /init scans your codebase — entry points, folder structure, naming"
echo "  conventions — and appends a summary to CLAUDE.md. This gives Claude"
echo "  project-specific knowledge on top of the workflow rules just installed."
echo "  Non-destructive: never overwrites existing content."
echo "  ─────────────────────────────────────────────────────────────────────"
echo ""

if [ ! -t 0 ]; then
  echo "  Tip: run 'claude' in this directory and type /init to add project context."
  echo ""
else
  read -r -p "  Add project-specific context via /init? [y/N] " _init_resp || true
  echo ""

  if [[ "${_init_resp:-}" =~ ^[Yy]$ ]]; then
    if command -v claude &>/dev/null; then
      _run_init
    else
      echo "  Claude Code CLI not found."
      read -r -p "  Install it now via npm? [y/N] " _install_resp || true
      echo ""
      if [[ "${_install_resp:-}" =~ ^[Yy]$ ]]; then
        if command -v npm &>/dev/null; then
          echo "  Installing @anthropic-ai/claude-code globally..."
          npm install -g @anthropic-ai/claude-code
          echo ""
          _run_init
        else
          echo "  npm not found. Install Node.js first: https://nodejs.org"
          _print_manual_init
        fi
      else
        _print_manual_init
      fi
    fi
  else
    _print_manual_init
  fi
fi

echo "  All done. Run 'claude' in this directory to start working."
echo ""
