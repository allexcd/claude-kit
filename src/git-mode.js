'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

const GIT_MODE_EXCLUDE = 'git-exclude';
const GIT_MODE_IGNORE = 'gitignore';
const GIT_MODE_TRACK = 'git-track';
const VALID_GIT_MODES = new Set([GIT_MODE_EXCLUDE, GIT_MODE_IGNORE, GIT_MODE_TRACK]);

const KIT_BLOCK_BEGIN = '# Claude Code workflow kit begin';
const KIT_BLOCK_END = '# Claude Code workflow kit end';
const LEGACY_KIT_MARKER = '# Claude Code workflow kit';

const LEGACY_GIT_ENTRIES = [
  'CLAUDE.md',
  '.claude/',
  'docs/workflow/',
  'tasks/todo.md',
  'tasks/lessons.md',
  '.cwk.lock',
];

function isGitRepo(targetDir) {
  const result = spawnSync('git', ['-C', targetDir, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
  return result.status === 0;
}

function gitDir(targetDir) {
  const result = spawnSync('git', ['-C', targetDir, 'rev-parse', '--git-dir'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }
  const rawPath = result.stdout.trim();
  return path.isAbsolute(rawPath) ? rawPath : path.join(targetDir, rawPath);
}

function normalizeGitMode(gitMode) {
  if (!gitMode) {
    return null;
  }
  if (!VALID_GIT_MODES.has(gitMode)) {
    throw new Error(`Invalid git mode in .cwk.lock: ${gitMode}`);
  }
  return gitMode;
}

function gitModeFromFlags(flags) {
  const choices = [];
  if (flags.gitExclude) {
    choices.push(GIT_MODE_EXCLUDE);
  }
  if (flags.gitignore) {
    choices.push(GIT_MODE_IGNORE);
  }
  if (flags.gitTrack) {
    choices.push(GIT_MODE_TRACK);
  }
  if (choices.length > 1) {
    throw new Error('Choose only one git handling flag: --git-exclude, --gitignore, or --git-track');
  }
  return choices[0] || null;
}

function deriveGitEntries(entries, lockFile) {
  const paths = new Set(entries.map((entry) => entry.path));
  paths.add(lockFile);
  return Array.from(paths);
}

function deriveKnownGitEntries(entries, lock, lockFile) {
  const paths = new Set([...deriveGitEntries(entries, lockFile), ...LEGACY_GIT_ENTRIES]);
  for (const filePath of Object.keys(lock?.files || {})) {
    paths.add(filePath);
  }
  for (const filePath of lock?.managedFiles || []) {
    paths.add(filePath);
  }
  return Array.from(paths);
}

function promptGitChoice(entries) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log('  How should git handle the installed files?');
    console.log('    [1] Exclude locally   - write to .git/info/exclude (your clone only)');
    console.log('    [2] Add to .gitignore - shared with the team via .gitignore');
    console.log('    [3] Track in git      - commit the files with the repo');
    console.log('');
    console.log('  Paths affected:');
    entries.forEach((entry) => console.log(`    ${entry}`));
    console.log('');

    rl.question('  Choice [1]: ', (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '2') {
        resolve(GIT_MODE_IGNORE);
      } else if (choice === '3') {
        resolve(GIT_MODE_TRACK);
      } else {
        resolve(GIT_MODE_EXCLUDE);
      }
    });
  });
}

function stripKitBlocks(content, knownEntries) {
  if (!content) {
    return '';
  }

  const known = new Set(knownEntries);
  const lines = content.split(/\r?\n/);
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === KIT_BLOCK_BEGIN) {
      while (i < lines.length && lines[i].trim() !== KIT_BLOCK_END) {
        i++;
      }
      continue;
    }

    if (trimmed.startsWith(LEGACY_KIT_MARKER)) {
      i++;
      while (i < lines.length) {
        const candidate = lines[i].trim();
        if (candidate === '' || known.has(candidate)) {
          i++;
          continue;
        }
        break;
      }
      i--;
      continue;
    }

    output.push(line);
  }

  const cleaned = output.join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/g, '\n');
  return cleaned.trim() === '' ? '' : cleaned;
}

function writeKitBlock(filePath, entries, knownEntries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const cleaned = stripKitBlocks(existing, knownEntries);
  const block = `${KIT_BLOCK_BEGIN}\n${entries.join('\n')}\n${KIT_BLOCK_END}\n`;
  const next = cleaned ? `${cleaned.replace(/\n+$/g, '\n')}\n${block}` : block;
  fs.writeFileSync(filePath, next, 'utf8');
}

function removeKitBlock(filePath, knownEntries) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const existing = fs.readFileSync(filePath, 'utf8');
  const hasBlock = existing.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed === KIT_BLOCK_BEGIN || trimmed.startsWith(LEGACY_KIT_MARKER);
  });
  if (!hasBlock) {
    return false;
  }

  const next = stripKitBlocks(existing, knownEntries);
  if (next === existing) {
    return false;
  }
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function applyGitMode(targetDir, gitMode, entries, knownEntries) {
  const mode = normalizeGitMode(gitMode) || GIT_MODE_EXCLUDE;

  if (mode === GIT_MODE_EXCLUDE) {
    const excludeGitDir = gitDir(targetDir);
    if (!excludeGitDir) {
      return { mode: GIT_MODE_TRACK, applied: false, skipped: 'not-git-repo' };
    }
    writeKitBlock(path.join(excludeGitDir, 'info', 'exclude'), entries, knownEntries);
    return { mode, applied: true };
  }

  if (mode === GIT_MODE_IGNORE) {
    if (!isGitRepo(targetDir)) {
      return { mode: GIT_MODE_TRACK, applied: false, skipped: 'not-git-repo' };
    }
    writeKitBlock(path.join(targetDir, '.gitignore'), entries, knownEntries);
    return { mode, applied: true };
  }

  return { mode, applied: false, ...(isGitRepo(targetDir) ? {} : { skipped: 'not-git-repo' }) };
}

function removeGitModeBlocks(targetDir, knownEntries) {
  const excludeGitDir = gitDir(targetDir);
  return {
    gitignore: removeKitBlock(path.join(targetDir, '.gitignore'), knownEntries),
    gitExclude: excludeGitDir
      ? removeKitBlock(path.join(excludeGitDir, 'info', 'exclude'), knownEntries)
      : false,
  };
}

module.exports = {
  GIT_MODE_EXCLUDE,
  GIT_MODE_IGNORE,
  GIT_MODE_TRACK,
  KIT_BLOCK_BEGIN,
  KIT_BLOCK_END,
  LEGACY_GIT_ENTRIES,
  LEGACY_KIT_MARKER,
  VALID_GIT_MODES,
  applyGitMode,
  deriveGitEntries,
  deriveKnownGitEntries,
  gitDir,
  gitModeFromFlags,
  isGitRepo,
  normalizeGitMode,
  promptGitChoice,
  removeGitModeBlocks,
  removeKitBlock,
  stripKitBlocks,
  writeKitBlock,
};
