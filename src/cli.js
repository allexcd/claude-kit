'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');
const {
  EXECUTABLE_FILES,
  INSTALL_FILES,
  MANAGED_FILES,
  USER_FILES,
} = require('./kit-files');
const {
  GIT_MODE_EXCLUDE,
  GIT_MODE_IGNORE,
  GIT_MODE_TRACK,
  applyGitMode,
  deriveGitEntries,
  deriveKnownGitEntries,
  gitModeFromFlags,
  isGitRepo,
  normalizeGitMode,
  promptGitChoice,
  removeGitModeBlocks,
} = require('./git-mode');

const KIT_DIR = path.join(__dirname, '..');
const LOCK_FILE = '.cwk.lock';

function getKitVersion(kitDir = KIT_DIR) {
  return JSON.parse(fs.readFileSync(path.join(kitDir, 'package.json'), 'utf8')).version;
}

function lockPath(targetDir) {
  return path.join(targetDir, LOCK_FILE);
}

function hashBuffer(buffer) {
  return require('crypto').createHash('sha256').update(buffer).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function templatePath(kitDir, filePath) {
  return path.join(kitDir, filePath);
}

function readLock(targetDir) {
  const filePath = lockPath(targetDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const files = raw.files && typeof raw.files === 'object' ? { ...raw.files } : {};

  for (const filePath of raw.managedFiles || []) {
    if (!files[filePath]) {
      files[filePath] = { ownership: 'kit-managed' };
    }
  }

  return { ...raw, files };
}

function writeLock(targetDir, data) {
  const { version, installedAt, updatedAt, gitMode, files, ...rest } = data;
  const next = {
    ...rest,
    version,
    ...(installedAt ? { installedAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(gitMode ? { gitMode } : {}),
    managedFiles: MANAGED_FILES,
    files,
  };
  fs.writeFileSync(lockPath(targetDir), JSON.stringify(next, null, 2) + '\n');
}

function gitEntriesFromLockFiles(files) {
  const entries = new Set(Object.keys(files || {}));
  entries.add(LOCK_FILE);
  return Array.from(entries);
}

function parseFlags(args) {
  return {
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force') || args.includes('-f'),
    gitExclude: args.includes('--git-exclude'),
    gitignore: args.includes('--gitignore'),
    gitTrack: args.includes('--git-track'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
  };
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function copyTemplate(kitDir, targetDir, filePath) {
  const source = templatePath(kitDir, filePath);
  const target = path.join(targetDir, filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return target;
}

function chmodExecutables(targetDir) {
  for (const filePath of EXECUTABLE_FILES) {
    const target = path.join(targetDir, filePath);
    if (fs.existsSync(target)) {
      fs.chmodSync(target, 0o755);
    }
  }
}

function tryRemoveDir(dir) {
  try {
    fs.rmdirSync(dir);
  } catch (_error) {
    // Best effort: directories with user files stay in place.
  }
}

function removeEmptyParents(targetDir, absPath) {
  let dir = path.dirname(absPath);
  while (dir !== targetDir && dir.startsWith(targetDir)) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
        continue;
      }
    } catch (_error) {
      // Best effort only.
    }
    break;
  }
}

function currentDate() {
  return new Date().toISOString().split('T')[0];
}

function ensureNotKitDir(targetDir, kitDir) {
  if (fs.realpathSync(targetDir) === fs.realpathSync(kitDir)) {
    throw new Error(`Run this from your project directory, not from inside the kit repo.`);
  }
}

function commandExists(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

function stageAndCommit(targetDir, filePaths) {
  const last = spawnSync('git', ['-C', targetDir, 'log', '--format=%s', '-1'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).stdout || '';
  const defaultMsg = /^[a-z]+(\(.+\))?: /.test(last.trim())
    ? 'chore: add claude workspace kit'
    : 'Add claude workspace kit';

  return (async () => {
    const branch = spawnSync('git', ['-C', targetDir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout.trim();
    if (branch === 'main' || branch === 'master') {
      console.log(`  You're on '${branch}'. Create a feature branch? [y/N]`);
      console.log('  Suggested: chore/add-claude-workspace-kit');
      const branchAnswer = await prompt('  ');
      if (/^y/i.test(branchAnswer)) {
        const branchName = await prompt('  Branch name [chore/add-claude-workspace-kit]: ');
        const checkout = spawnSync('git', ['-C', targetDir, 'checkout', '-b', branchName || 'chore/add-claude-workspace-kit'], {
          stdio: 'inherit',
        });
        if (checkout.status !== 0) {
          throw new Error('git branch creation failed');
        }
        console.log('');
      }
    }

    console.log(`  Commit message: ${defaultMsg}`);
    const customMsg = await prompt('  Press Enter to accept or type a custom message: ');
    const commitMsg = customMsg || defaultMsg;
    spawnSync('git', ['-C', targetDir, 'add', ...filePaths], { stdio: 'ignore' });
    const result = spawnSync('git', ['-C', targetDir, 'commit', '-m', commitMsg], { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error('git commit failed');
    }
    console.log('  OK    committed');
    console.log('');
  })();
}

async function maybeCommitTrackedInstall(targetDir, mode, installedPaths) {
  if (mode !== GIT_MODE_TRACK || !isGitRepo(targetDir)) {
    return;
  }
  if (!process.stdin.isTTY) {
    console.log('  Non-interactive install with --git-track: skipping commit prompt.');
    console.log('  Stage and commit the installed files manually.');
    console.log('');
    return;
  }

  console.log('  Would you like to commit the installed files? [y/N]');
  const answer = await prompt('  ');
  console.log('');
  if (/^y/i.test(answer)) {
    await stageAndCommit(targetDir, [...installedPaths, LOCK_FILE]);
  }
}

async function maybeRunProjectContext(targetDir) {
  if (!process.stdin.isTTY) {
    console.log("  Tip: run 'claude' in this directory and type /init to add project context.");
    console.log('');
    return;
  }

  console.log('  -- Optional: add project context --------------------------------');
  console.log('  /init scans your codebase and appends a summary to CLAUDE.md.');
  console.log('  Non-destructive: never overwrites existing content.');
  console.log('  ------------------------------------------------------------------');
  console.log('');

  const initAnswer = await prompt('  Add project-specific context via /init? [y/N] ');
  console.log('');
  if (!/^y/i.test(initAnswer)) {
    return;
  }

  if (commandExists('claude')) {
    spawnSync('claude', ['--allowedTools', 'Read,Write,Glob,Grep,Bash(git log:git status:git branch:find:ls)'], {
      cwd: targetDir,
      stdio: 'inherit',
    });
    console.log('');
    console.log('  Done. CLAUDE.md updated with project context.');
    return;
  }

  console.log('  Claude Code CLI not found.');
  const installAnswer = await prompt('  Install it now via npm? [y/N] ');
  console.log('');
  if (/^y/i.test(installAnswer)) {
    if (!commandExists('npm')) {
      console.log('  npm not found. Install Node.js first: https://nodejs.org');
      return;
    }
    spawnSync('npm', ['install', '-g', '@anthropic-ai/claude-code'], { stdio: 'inherit' });
    spawnSync('claude', ['--allowedTools', 'Read,Write,Glob,Grep,Bash(git log:git status:git branch:find:ls)'], {
      cwd: targetDir,
      stdio: 'inherit',
    });
  }
}

async function resolveInitGitMode(targetDir, flags, gitEntries) {
  const flagMode = gitModeFromFlags(flags);
  if (flagMode) {
    return flagMode;
  }
  if (!isGitRepo(targetDir)) {
    return GIT_MODE_TRACK;
  }
  if (!process.stdin.isTTY) {
    console.log('  Non-interactive install: defaulting to local-only exclusion (.git/info/exclude)');
    return GIT_MODE_EXCLUDE;
  }
  console.log('');
  return promptGitChoice(gitEntries);
}

async function cmdInit(args, options = {}) {
  const kitDir = options.kitDir || KIT_DIR;
  const targetDir = options.targetDir || process.cwd();
  const flags = parseFlags(args);
  const version = getKitVersion(kitDir);
  const existingLock = readLock(targetDir);
  const lockFiles = {};
  const installedPaths = [];
  let installed = 0;
  let skipped = 0;

  gitModeFromFlags(flags);
  ensureNotKitDir(targetDir, kitDir);

  console.log('');
  console.log('  claude-workspace-kit installer');
  console.log('  ============================');
  console.log('');

  for (const entry of INSTALL_FILES) {
    const source = templatePath(kitDir, entry.path);
    const target = path.join(targetDir, entry.path);
    let copied = false;
    if (!fs.existsSync(source)) {
      console.log(`  x     ${entry.path}  (not found in kit)`);
      continue;
    }
    const sourceHash = hashFile(source);
    if (fs.existsSync(target) && !flags.force) {
      console.log(`  skip  ${entry.path}  (exists)`);
      skipped++;
    } else {
      copyTemplate(kitDir, targetDir, entry.path);
      console.log(`  OK    ${entry.path}`);
      installed++;
      copied = true;
    }
    if (fs.existsSync(target)) {
      const targetHash = hashFile(target);
      const existingMeta = existingLock?.files?.[entry.path];
      if (copied || targetHash === sourceHash) {
        lockFiles[entry.path] = {
          ownership: entry.ownership,
          hash: targetHash,
        };
        installedPaths.push(entry.path);
      } else if (existingMeta) {
        lockFiles[entry.path] = {
          ownership: existingMeta.ownership || entry.ownership,
          ...(existingMeta.hash ? { hash: existingMeta.hash } : {}),
        };
        installedPaths.push(entry.path);
      }
    }
  }

  chmodExecutables(targetDir);

  const promptGitEntries = deriveGitEntries(INSTALL_FILES, LOCK_FILE);
  const applyGitEntries = gitEntriesFromLockFiles(lockFiles);
  const chosenMode = await resolveInitGitMode(targetDir, flags, promptGitEntries);
  const gitResult = applyGitMode(targetDir, chosenMode, applyGitEntries, deriveKnownGitEntries(INSTALL_FILES, null, LOCK_FILE));

  if (gitResult.skipped === 'not-git-repo') {
    console.log('  skip  git setup  (not a git repo)');
  } else if (gitResult.mode === GIT_MODE_EXCLUDE && gitResult.applied) {
    console.log('  OK    .git/info/exclude  (kit block refreshed)');
  } else if (gitResult.mode === GIT_MODE_IGNORE) {
    console.log('  OK    .gitignore  (kit block refreshed)');
  } else if (gitResult.mode === GIT_MODE_TRACK) {
    console.log('  OK    git tracking enabled - files will be committed with the repo');
  }

  writeLock(targetDir, {
    version,
    installedAt: currentDate(),
    gitMode: gitResult.mode,
    files: lockFiles,
  });

  console.log('');
  console.log(`  Done: ${installed} installed, ${skipped} skipped`);
  if (skipped > 0 && !flags.force) {
    console.log('  Run with --force to overwrite existing files');
  }
  console.log('');

  await maybeCommitTrackedInstall(targetDir, gitResult.mode, installedPaths);
  await maybeRunProjectContext(targetDir);
}

async function resolveUpdateGitMode(targetDir, lock, flags, dryRun) {
  const flagMode = gitModeFromFlags(flags);
  if (flagMode) {
    return { gitMode: flagMode, shouldApply: !dryRun };
  }

  const lockedMode = normalizeGitMode(lock.gitMode);
  if (lockedMode) {
    return { gitMode: lockedMode, shouldApply: !dryRun };
  }

  if (dryRun) {
    return { gitMode: null, shouldApply: false };
  }

  if (isGitRepo(targetDir) && process.stdin.isTTY) {
    console.log('');
    return {
      gitMode: await promptGitChoice(deriveGitEntries(INSTALL_FILES, LOCK_FILE)),
      shouldApply: true,
      migrated: true,
    };
  }

  if (isGitRepo(targetDir)) {
    return { gitMode: null, shouldApply: false, skippedMissingMode: true };
  }

  return { gitMode: GIT_MODE_TRACK, shouldApply: true };
}

function lockMetaForExisting(entry, templateHash) {
  return {
    ownership: entry.ownership,
    hash: templateHash,
  };
}

function isLocallyModified(absPath, meta, templateHash) {
  if (!fs.existsSync(absPath)) {
    return false;
  }
  const baseline = meta?.hash || templateHash;
  if (!baseline) {
    return true;
  }
  return hashFile(absPath) !== baseline;
}

async function cmdUpdate(args, options = {}) {
  const kitDir = options.kitDir || KIT_DIR;
  const targetDir = options.targetDir || process.cwd();
  const flags = parseFlags(args);
  const lock = readLock(targetDir);
  const version = getKitVersion(kitDir);
  const prefix = flags.dryRun ? '  would ' : '  ';
  let updated = 0;
  let skipped = 0;
  let warned = 0;
  let userOwned = 0;

  if (!lock) {
    throw new Error(`No ${LOCK_FILE} found. Run 'npx claude-workspace-kit init' first.`);
  }

  console.log('');
  console.log('  claude-workspace-kit update');
  console.log('  ===========================');
  console.log(`  Installed: v${lock.version || 'unknown'} -> Available: v${version}`);
  console.log('');

  const gitResolution = await resolveUpdateGitMode(targetDir, lock, flags, flags.dryRun);
  const newLockFiles = {};
  const manifestPaths = new Set(INSTALL_FILES.map((entry) => entry.path));

  for (const entry of INSTALL_FILES) {
    const source = templatePath(kitDir, entry.path);
    if (!fs.existsSync(source)) {
      continue;
    }

    const target = path.join(targetDir, entry.path);
    const templateHash = hashFile(source);
    const lockMeta = lock.files[entry.path];

    if (entry.ownership === 'user-owned') {
      userOwned++;
      if (lockMeta) {
        newLockFiles[entry.path] = lockMeta;
        continue;
      }
      if (!fs.existsSync(target)) {
        if (!flags.dryRun) {
          copyTemplate(kitDir, targetDir, entry.path);
        }
        newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
        console.log(`${prefix}+     ${entry.path}  (created, user-owned)`);
        updated++;
      } else if (flags.force) {
        if (!flags.dryRun) {
          copyTemplate(kitDir, targetDir, entry.path);
        }
        newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
        console.log(`${prefix}OK    ${entry.path}  (forced, user-owned)`);
        updated++;
      } else if (hashFile(target) === templateHash) {
        newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
        skipped++;
      } else {
        console.log(`${prefix}skip  ${entry.path}  (exists, user-owned)`);
        skipped++;
      }
      continue;
    }

    if (!lockMeta && fs.existsSync(target) && !flags.force) {
      if (hashFile(target) === templateHash) {
        newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
        skipped++;
      } else {
        console.log(`${prefix}warn  ${entry.path}  (exists - skipped, use --force)`);
        warned++;
      }
      continue;
    }

    if (!fs.existsSync(target)) {
      if (!flags.dryRun) {
        copyTemplate(kitDir, targetDir, entry.path);
      }
      newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
      console.log(`${prefix}+     ${entry.path}  (created)`);
      updated++;
      continue;
    }

    const currentHash = hashFile(target);
    if (currentHash === templateHash) {
      newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
      skipped++;
      continue;
    }

    if (isLocallyModified(target, lockMeta, templateHash) && !flags.force) {
      newLockFiles[entry.path] = lockMeta || lockMetaForExisting(entry, templateHash);
      console.log(`${prefix}warn  ${entry.path}  (locally modified - skipped, use --force)`);
      warned++;
      continue;
    }

    if (!flags.dryRun) {
      copyTemplate(kitDir, targetDir, entry.path);
    }
    newLockFiles[entry.path] = { ownership: entry.ownership, hash: templateHash };
    console.log(`${prefix}OK    ${entry.path}`);
    updated++;
  }

  for (const [filePath, meta] of Object.entries(lock.files)) {
    if (manifestPaths.has(filePath)) {
      continue;
    }
    const target = path.join(targetDir, filePath);
    if (!fs.existsSync(target)) {
      continue;
    }
    if (meta.ownership === 'user-owned') {
      console.log(`${prefix}skip  ${filePath}  (removed from kit, user-owned)`);
      skipped++;
      continue;
    }

    const locallyModified = isLocallyModified(target, meta, null);
    if (locallyModified && !flags.force) {
      console.log(`${prefix}warn  ${filePath}  (removed from kit, locally modified - kept)`);
      warned++;
      continue;
    }

    if (!flags.dryRun) {
      fs.rmSync(target);
      removeEmptyParents(targetDir, target);
    }
    console.log(`${prefix}-     ${filePath}  (removed from kit)`);
    updated++;
  }

  let finalGitMode = gitResolution.gitMode;
  if (gitResolution.shouldApply) {
    const result = applyGitMode(
      targetDir,
      gitResolution.gitMode,
      gitEntriesFromLockFiles(newLockFiles),
      deriveKnownGitEntries(INSTALL_FILES, lock, LOCK_FILE),
    );
    finalGitMode = result.mode;
    if (result.skipped === 'not-git-repo') {
      console.log('  skip  git setup  (not a git repo)');
    } else if (result.mode === GIT_MODE_EXCLUDE && result.applied) {
      console.log('  Git: paths written to .git/info/exclude');
    } else if (result.mode === GIT_MODE_IGNORE) {
      console.log('  Git: paths written to .gitignore');
    }
  }

  if (!flags.dryRun) {
    writeLock(targetDir, {
      ...lock,
      version,
      installedAt: lock.installedAt,
      updatedAt: currentDate(),
      gitMode: finalGitMode || undefined,
      files: newLockFiles,
    });
    chmodExecutables(targetDir);
  }

  console.log('');
  console.log(`  Done: ${updated} updated, ${skipped} skipped, ${warned} warnings, ${userOwned} user-owned`);
  if (warned > 0) {
    console.log('  Files with warnings were skipped. Use --force to overwrite or remove them.');
  }
  if (gitResolution.skippedMissingMode) {
    console.log('  Git: skipped ignore/exclude changes because this old lockfile has no saved git mode.');
    console.log('  Run "cwk update" in an interactive terminal to choose git handling.');
  }
  if (flags.dryRun) {
    console.log('  This was a dry run - no files were modified.');
  }
  console.log('');
}

function defaultMetaForUserFile(kitDir, filePath) {
  const source = templatePath(kitDir, filePath);
  return {
    ownership: 'user-owned',
    hash: fs.existsSync(source) ? hashFile(source) : undefined,
  };
}

async function confirmRemoveModifiedFile(filePath) {
  const answer = await prompt(`  Remove locally modified ${filePath}? [y/N] `);
  return /^y(es)?$/i.test(answer);
}

async function cmdUninstall(args, options = {}) {
  const kitDir = options.kitDir || KIT_DIR;
  const targetDir = options.targetDir || process.cwd();
  const flags = parseFlags(args);
  const lock = readLock(targetDir);

  if (!lock) {
    throw new Error(`No ${LOCK_FILE} found. Nothing to uninstall.`);
  }

  console.log('');
  console.log('  claude-workspace-kit uninstall');
  console.log('  ==============================');
  console.log('');

  const files = new Map();
  for (const [filePath, meta] of Object.entries(lock.files)) {
    files.set(filePath, meta);
  }
  for (const filePath of lock.managedFiles || []) {
    if (!files.has(filePath)) {
      files.set(filePath, { ownership: 'kit-managed' });
    }
  }
  if (flags.all) {
    for (const filePath of USER_FILES) {
      if (!files.has(filePath)) {
        files.set(filePath, defaultMetaForUserFile(kitDir, filePath));
      }
    }
  }

  const removedDirs = new Set();
  let removed = 0;
  let skipped = 0;
  let modifiedSkipped = 0;

  for (const [filePath, meta] of files) {
    const ownership = meta.ownership || 'kit-managed';
    if (ownership === 'user-owned' && !flags.all) {
      skipped++;
      continue;
    }

    const target = path.join(targetDir, filePath);
    if (!fs.existsSync(target)) {
      continue;
    }

    const source = templatePath(kitDir, filePath);
    const templateHash = fs.existsSync(source) ? hashFile(source) : null;
    const locallyModified = isLocallyModified(target, meta, templateHash);

    if (locallyModified && !flags.force) {
      if (ownership === 'kit-managed') {
        const verb = flags.dryRun ? 'would skip' : 'skip';
        console.log(`  ${verb}  ${filePath}  (locally modified, use --force to remove)`);
        skipped++;
        modifiedSkipped++;
        continue;
      }

      if (flags.dryRun) {
        console.log(`  would prompt  ${filePath}  (locally modified user-owned file)`);
        skipped++;
        modifiedSkipped++;
        continue;
      }

      if (!process.stdin.isTTY) {
        console.log(`  skip  ${filePath}  (locally modified user-owned file, confirmation required)`);
        skipped++;
        modifiedSkipped++;
        continue;
      }

      if (!(await confirmRemoveModifiedFile(filePath))) {
        console.log(`  skip  ${filePath}  (locally modified user-owned file)`);
        skipped++;
        modifiedSkipped++;
        continue;
      }
    }

    const label = ownership === 'user-owned' ? '(user-owned)' : '(kit-managed)';
    if (flags.dryRun) {
      console.log(`  would remove  ${filePath}  ${label}`);
    } else {
      fs.rmSync(target);
      console.log(`  OK    removed  ${filePath}  ${label}`);
      removedDirs.add(path.dirname(target));
    }
    removed++;
  }

  const knownGitEntries = deriveKnownGitEntries(INSTALL_FILES, lock, LOCK_FILE);
  if (flags.dryRun) {
    console.log('  would clean  .gitignore and .git/info/exclude  (kit blocks)');
  } else {
    const cleaned = removeGitModeBlocks(targetDir, knownGitEntries);
    if (cleaned.gitignore) {
      console.log('  OK    cleaned  .gitignore  (kit block)');
    }
    if (cleaned.gitExclude) {
      console.log('  OK    cleaned  .git/info/exclude  (kit block)');
    }
  }

  if (!flags.dryRun) {
    [...removedDirs]
      .sort((a, b) => b.length - a.length)
      .forEach((dir) => {
        tryRemoveDir(dir);
        tryRemoveDir(path.dirname(dir));
      });
  }

  if (modifiedSkipped > 0) {
    const verb = flags.dryRun ? 'would keep' : 'keep';
    console.log(`  ${verb}  ${LOCK_FILE}  (modified files remain)`);
  } else if (!flags.dryRun && fs.existsSync(lockPath(targetDir))) {
    fs.rmSync(lockPath(targetDir));
    console.log(`  OK    removed  ${LOCK_FILE}`);
  } else if (flags.dryRun) {
    console.log(`  would remove  ${LOCK_FILE}`);
  }

  console.log('');
  if (flags.dryRun) {
    console.log(`  Dry run: ${removed} file(s) would be removed, ${skipped} skipped`);
  } else {
    console.log(`  Done: ${removed} file(s) removed, ${skipped} skipped`);
  }
  if (modifiedSkipped > 0) {
    console.log('  Run with --force to also remove locally modified files');
  } else if (skipped > 0 && !flags.all) {
    console.log('  Run with --all to also remove user-owned files');
  }
  console.log('');
}

function printHelp() {
  console.log(`
  claude-workspace-kit (cwk) v${getKitVersion()}

  Usage:
    cwk [init] [flags]                            Install the kit into the current directory
    cwk update [flags]                            Update kit-managed files to the latest version
    cwk uninstall [flags]                         Remove kit files from the current directory
    npx claude-workspace-kit [init] [flags]         Install the kit into the current directory
    npx claude-workspace-kit update [flags]         Update kit-managed files to the latest version
    npx claude-workspace-kit uninstall [flags]      Remove kit files from the current directory

  Init flags:
    --force          Overwrite existing files
    --git-exclude    Exclude via .git/info/exclude (local only, default)
    --gitignore      Exclude via .gitignore (shared with team)
    --git-track      Track files in git (no exclusion)

  Update flags:
    --force          Overwrite files even if locally modified
    --dry-run        Preview changes without writing
    --git-exclude    Refresh paths in .git/info/exclude
    --gitignore      Refresh paths in .gitignore
    --git-track      Stop writing git ignore/exclude files

  Uninstall flags:
    --all            Also remove user-owned files (CLAUDE.md, tasks/)
    --force          Remove locally modified files without prompting
    --dry-run        Preview what would be removed

  Examples:
    npx claude-workspace-kit init                        Interactive install
    npx claude-workspace-kit init --gitignore --force    Install, share exclusions, overwrite
    npx claude-workspace-kit@latest update               Update to latest kit files
    npx claude-workspace-kit uninstall --dry-run         Preview uninstall
`);
}

async function main(argv) {
  const [cmd = 'init', ...rest] = argv;

  if (cmd === '--help' || cmd === '-h' || rest.includes('--help') || rest.includes('-h')) {
    printHelp();
    return;
  }
  if (cmd === '--version' || cmd === '-v' || rest.includes('--version') || rest.includes('-v')) {
    console.log(getKitVersion());
    return;
  }

  switch (cmd) {
    case 'init':
      await cmdInit(rest);
      break;
    case 'update':
      await cmdUpdate(rest);
      break;
    case 'uninstall':
      await cmdUninstall(rest);
      break;
    default:
      if (cmd.startsWith('--')) {
        await cmdInit([cmd, ...rest]);
      } else {
        throw new Error(`Unknown command: ${cmd}`);
      }
  }
}

module.exports = {
  LOCK_FILE,
  cmdInit,
  cmdUninstall,
  cmdUpdate,
  getKitVersion,
  hashFile,
  main,
  parseFlags,
  readLock,
  writeLock,
};
