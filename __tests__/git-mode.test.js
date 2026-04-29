'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  KIT_BLOCK_BEGIN,
  KIT_BLOCK_END,
  applyGitMode,
  deriveGitEntries,
  gitDir,
  gitModeFromFlags,
  removeKitBlock,
  stripKitBlocks,
  writeKitBlock,
} = require('../src/git-mode');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwk-git-mode-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('git mode helpers', () => {
  it('rejects conflicting git flags', () => {
    expect(() => gitModeFromFlags({
      gitExclude: true,
      gitignore: true,
      gitTrack: false,
    })).toThrow('Choose only one');
  });

  it('writes exact-path bounded blocks and migrates legacy broad blocks', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, [
      'node_modules/',
      '# Claude Code workflow kit',
      'CLAUDE.md',
      '.claude/',
      'docs/workflow/',
      '.cwk.lock',
      'dist/',
      '',
    ].join('\n'), 'utf8');

    writeKitBlock(gitignorePath, [
      'CLAUDE.md',
      '.claude/settings.json',
      '.cwk.lock',
    ], [
      'CLAUDE.md',
      '.claude/',
      'docs/workflow/',
      '.cwk.lock',
      '.claude/settings.json',
    ]);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    expect(content).toContain(KIT_BLOCK_BEGIN);
    expect(content).toContain(KIT_BLOCK_END);
    expect(content).toContain('.claude/settings.json');
    expect(content).not.toContain('.claude/\n');
  });

  it('does not rewrite files that contain no kit block', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules/\n', 'utf8');

    expect(removeKitBlock(gitignorePath, ['CLAUDE.md'])).toBe(false);
    expect(fs.readFileSync(gitignorePath, 'utf8')).toBe('node_modules/\n');
  });

  it('strips bounded blocks and preserves unrelated content', () => {
    const content = [
      'node_modules/',
      KIT_BLOCK_BEGIN,
      'CLAUDE.md',
      '.cwk.lock',
      KIT_BLOCK_END,
      'dist/',
      '',
    ].join('\n');

    expect(stripKitBlocks(content, ['CLAUDE.md', '.cwk.lock'])).toBe('node_modules/\ndist/\n');
  });

  it('writes git-exclude entries to the resolved git dir', () => {
    const gitDirPath = path.join(tmpDir, 'actual-git-dir');
    const worktree = path.join(tmpDir, 'worktree');
    const result = spawnSync('git', ['init', `--separate-git-dir=${gitDirPath}`, worktree], {
      stdio: 'ignore',
    });
    expect(result.status).toBe(0);

    const entries = deriveGitEntries([{ path: 'CLAUDE.md' }], '.cwk.lock');
    expect(fs.realpathSync(gitDir(worktree))).toBe(fs.realpathSync(gitDirPath));
    applyGitMode(worktree, 'git-exclude', entries, entries);

    expect(fs.readFileSync(path.join(gitDirPath, 'info', 'exclude'), 'utf8')).toContain(KIT_BLOCK_BEGIN);
  });

  it('reports git-track as skipped outside a git repo', () => {
    expect(applyGitMode(tmpDir, 'git-track', ['CLAUDE.md'], ['CLAUDE.md'])).toMatchObject({
      mode: 'git-track',
      applied: false,
      skipped: 'not-git-repo',
    });
  });
});
