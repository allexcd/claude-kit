#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const KIT_DIR = path.join(__dirname, '..');
const TARGET_DIR = process.cwd();
const LOCK_FILE = '.cwk.lock';
const LOCK_PATH = path.join(TARGET_DIR, LOCK_FILE);

const MANAGED_FILES = [
  '.claude/settings.json',
  '.claude/agents/deep-reviewer.md',
  '.claude/agents/fast-implementer.md',
  '.claude/commands/kickoff.md',
  '.claude/commands/verify-and-close.md',
  '.claude/commands/elegant-fix.md',
  '.claude/skills/autonomous-bug-fixing/SKILL.md',
  '.claude/skills/demand-elegance/SKILL.md',
  '.claude/skills/plan-mode/SKILL.md',
  '.claude/skills/self-improvement/SKILL.md',
  '.claude/skills/subagent-strategy/SKILL.md',
  '.claude/skills/verification/SKILL.md',
  '.claude/rules/backend.md',
  '.claude/output-styles/terse.md',
  '.claude/hooks/session-start.sh',
  'docs/workflow/workflow-orchestration.md',
];

const USER_FILES = ['CLAUDE.md', 'tasks/todo.md', 'tasks/lessons.md'];

// ── lock file ─────────────────────────────────────────────────────────────────

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) {return null;}
  return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
}

function writeLock() {
  fs.writeFileSync(LOCK_PATH, JSON.stringify({
    version: PKG.version,
    installedAt: new Date().toISOString().split('T')[0],
    managedFiles: MANAGED_FILES,
  }, null, 2) + '\n');
}

function updateLock(existing) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify({
    ...existing,
    version: PKG.version,
    updatedAt: new Date().toISOString().split('T')[0],
    managedFiles: MANAGED_FILES,
  }, null, 2) + '\n');
}

// ── helpers ───────────────────────────────────────────────────────────────────

function hasBash() {
  return spawnSync('bash', ['--version'], { stdio: 'pipe' }).status === 0;
}

function tryRemoveDir(dir) {
  try { fs.rmdirSync(dir); } catch (_) { /* ignore — dir not empty */ }
}

function removeKitBlock(filePath) {
  if (!fs.existsSync(filePath)) {return;}
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const markerIdx = lines.findIndex(l => l.startsWith('# Claude Code workflow kit'));
  if (markerIdx === -1) {return;}
  const start = markerIdx > 0 && lines[markerIdx - 1].trim() === '' ? markerIdx - 1 : markerIdx;
  let end = markerIdx + 1;
  while (end < lines.length && lines[end].trim() !== '') {end++;}
  lines.splice(start, end - start);
  fs.writeFileSync(filePath, lines.join('\n'));
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ── commands ──────────────────────────────────────────────────────────────────

function cmdInit(args) {
  if (!hasBash()) {
    console.error('\n  ERROR: bash is required for init but was not found.');
    console.error('  Windows users: run from Git Bash / WSL, or clone the repo and run: bash install.sh\n');
    process.exit(1);
  }

  const result = spawnSync('bash', [path.join(KIT_DIR, 'install.sh'), ...args], {
    stdio: 'inherit',
    cwd: TARGET_DIR,
  });

  if (result.status === 0) {
    writeLock();
  } else {
    process.exit(result.status ?? 1);
  }
}

function cmdUpdate(args) {
  const dryRun = args.includes('--dry-run');

  const lock = readLock();
  if (!lock) {
    console.error(`\n  ERROR: No ${LOCK_FILE} found. Run 'npx cwk init' first.\n`);
    process.exit(1);
  }

  if (dryRun) {console.log('');}
  let changed = 0, unchanged = 0;

  for (const file of MANAGED_FILES) {
    const src = path.join(KIT_DIR, file);
    const dest = path.join(TARGET_DIR, file);
    if (!fs.existsSync(src)) {continue;}

    const srcBuf = fs.readFileSync(src);
    const destBuf = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
    const isDiff = !destBuf || !srcBuf.equals(destBuf);
    const label = !destBuf ? '  (new)' : '';

    if (dryRun) {
      if (isDiff) { console.log(`  • ${file}${label}`); changed++; }
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    if (isDiff) { console.log(`  ✓  ${file}${label}`); changed++; }
    else {unchanged++;}
  }

  if (!dryRun) {
    updateLock(lock);
    const hook = path.join(TARGET_DIR, '.claude/hooks/session-start.sh');
    if (fs.existsSync(hook)) {fs.chmodSync(hook, 0o755);}
    console.log(`\n  Updated ${changed} file${changed !== 1 ? 's' : ''} (${unchanged} already current).\n`);
  } else if (changed === 0) {
    console.log('  All kit files are up to date.\n');
  } else {
    console.log(`\n  ${changed} file${changed !== 1 ? 's' : ''} would be updated. (dry run)\n`);
  }
}

async function cmdUninstall(args) {
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');

  const lock = readLock();
  if (!lock) {
    console.error(`\n  ERROR: No ${LOCK_FILE} found. Nothing to uninstall.\n`);
    process.exit(1);
  }

  let removeUserFiles = all;
  if (!dryRun && !all && process.stdin.isTTY) {
    const ans = await prompt('\n  Also remove user-owned files (CLAUDE.md, tasks/)? [y/N] ');
    removeUserFiles = /^y/i.test(ans);
    console.log('');
  }

  const filesToRemove = [...(lock.managedFiles || MANAGED_FILES)];
  if (removeUserFiles) {filesToRemove.push(...USER_FILES);}

  if (dryRun) {
    console.log('\n  Files that would be removed:');
    for (const file of filesToRemove) {
      const exists = fs.existsSync(path.join(TARGET_DIR, file));
      console.log(`  • ${file}${exists ? '' : '  (not found)'}`);
    }
    console.log(`  • ${LOCK_FILE}`);
    if (!all) {console.log('\n  User-owned files preserved. Use --all to also remove them.');}
    console.log('\n  (dry run — no files removed)\n');
    return;
  }

  const dirsToCheck = new Set();
  for (const file of filesToRemove) {
    const fullPath = path.join(TARGET_DIR, file);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`  ✓  removed  ${file}`);
      dirsToCheck.add(path.dirname(fullPath));
    }
  }

  // Clean up empty dirs, deepest first
  [...dirsToCheck]
    .sort((a, b) => b.length - a.length)
    .filter(d => d !== TARGET_DIR && d.startsWith(TARGET_DIR))
    .forEach(d => { tryRemoveDir(d); tryRemoveDir(path.dirname(d)); });

  // Strip kit block from git exclusion files
  removeKitBlock(path.join(TARGET_DIR, '.git', 'info', 'exclude'));
  removeKitBlock(path.join(TARGET_DIR, '.gitignore'));

  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
    console.log(`  ✓  removed  ${LOCK_FILE}`);
  }

  console.log('\n  Uninstall complete.\n');
}

// ── help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
  claude-workspace-kit (cwk) v${PKG.version}

  Usage:
    npx cwk [init] [flags]         Install the kit into the current directory
    npx cwk update [flags]         Update kit-managed files to the latest version
    npx cwk uninstall [flags]      Remove kit files from the current directory

  Init flags:
    --force          Overwrite existing files
    --git-exclude    Exclude via .git/info/exclude (local only, default)
    --gitignore      Exclude via .gitignore (shared with team)
    --git-track      Track files in git (no exclusion)

  Update flags:
    --dry-run        Preview changes without writing

  Uninstall flags:
    --all            Also remove user-owned files (CLAUDE.md, tasks/)
    --dry-run        Preview what would be removed

  Examples:
    npx cwk init                        Interactive install
    npx cwk init --gitignore --force    Install, share exclusions, overwrite
    npx claude-workspace-kit@latest update       Update to latest kit files
    npx cwk uninstall --dry-run         Preview uninstall
`);
}

// ── main ──────────────────────────────────────────────────────────────────────

const [,, cmd = 'init', ...rest] = process.argv;

if (cmd === '--help' || cmd === '-h') { printHelp(); process.exit(0); }

switch (cmd) {
  case 'init':      cmdInit(rest); break;
  case 'update':    cmdUpdate(rest); break;
  case 'uninstall': cmdUninstall(rest).catch(err => { console.error(err); process.exit(1); }); break;
  default:
    if (cmd.startsWith('--')) { cmdInit([cmd, ...rest]); }
    else { console.error(`\n  Unknown command: ${cmd}`); printHelp(); process.exit(1); }
}
