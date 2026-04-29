'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  LOCK_FILE,
  cmdInit,
  cmdUninstall,
  cmdUpdate,
  hashFile,
  main,
  readLock,
  writeLock,
} = require('../src/cli');
const { KIT_BLOCK_BEGIN } = require('../src/git-mode');

const KIT_DIR = path.join(__dirname, '..');
let tmpDir;
let originalStdinIsTTY;

function gitInit(targetDir) {
  spawnSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' });
}

function lock(targetDir) {
  return JSON.parse(fs.readFileSync(path.join(targetDir, LOCK_FILE), 'utf8'));
}

function file(targetDir, filePath) {
  return path.join(targetDir, filePath);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwk-cli-'));
  originalStdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  if (originalStdinIsTTY) {
    Object.defineProperty(process.stdin, 'isTTY', originalStdinIsTTY);
  } else {
    delete process.stdin.isTTY;
  }
  console.log.mockRestore();
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cli lifecycle', () => {
  it('init saves gitignore mode and writes exact installed paths', async () => {
    gitInit(tmpDir);

    await cmdInit(['--gitignore'], { targetDir: tmpDir, kitDir: KIT_DIR });

    const nextLock = lock(tmpDir);
    expect(nextLock.gitMode).toBe('gitignore');
    expect(nextLock.files['CLAUDE.md'].ownership).toBe('user-owned');
    expect(nextLock.files['.claude/settings.json'].ownership).toBe('kit-managed');

    const gitignore = fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain(KIT_BLOCK_BEGIN);
    expect(gitignore).toContain('.claude/settings.json');
    expect(gitignore).not.toContain('.claude/\n');
  });

  it('init falls back to git-track when git-exclude is requested outside git', async () => {
    await cmdInit(['--git-exclude'], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(lock(tmpDir).gitMode).toBe('git-track');
    expect(fs.existsSync(file(tmpDir, '.git'))).toBe(false);
    expect(fs.existsSync(file(tmpDir, '.gitignore'))).toBe(false);
  });

  it('init does not claim skipped pre-existing files that differ from the kit template', async () => {
    gitInit(tmpDir);
    fs.mkdirSync(file(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(file(tmpDir, '.claude/settings.json'), 'local settings\n', 'utf8');

    await cmdInit(['--gitignore'], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(lock(tmpDir).files['.claude/settings.json']).toBeUndefined();
    expect(fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8')).not.toContain('.claude/settings.json');
    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });
    expect(fs.readFileSync(file(tmpDir, '.claude/settings.json'), 'utf8')).toBe('local settings\n');
  });

  it('update skips git changes for old non-interactive lockfiles', async () => {
    gitInit(tmpDir);
    fs.mkdirSync(file(tmpDir, '.claude'), { recursive: true });
    fs.copyFileSync(file(KIT_DIR, '.claude/settings.json'), file(tmpDir, '.claude/settings.json'));
    fs.writeFileSync(file(tmpDir, LOCK_FILE), JSON.stringify({
      version: '0.1.0',
      customField: 'keep-me',
      managedFiles: ['.claude/settings.json'],
    }, null, 2) + '\n');

    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(lock(tmpDir).gitMode).toBeUndefined();
    expect(lock(tmpDir).customField).toBe('keep-me');
    expect(fs.existsSync(file(tmpDir, '.gitignore'))).toBe(false);
    expect(fs.existsSync(file(tmpDir, '.git/info/exclude'))).toBe(true);
    expect(fs.readFileSync(file(tmpDir, '.git/info/exclude'), 'utf8')).not.toContain(KIT_BLOCK_BEGIN);
  });

  it('update reuses saved gitignore mode and refreshes legacy git blocks', async () => {
    gitInit(tmpDir);
    await cmdInit(['--git-track'], { targetDir: tmpDir, kitDir: KIT_DIR });
    const currentLock = readLock(tmpDir);
    currentLock.gitMode = 'gitignore';
    writeLock(tmpDir, currentLock);
    fs.writeFileSync(file(tmpDir, '.gitignore'), [
      'node_modules/',
      '# Claude Code workflow kit',
      'CLAUDE.md',
      '.claude/',
      '.cwk.lock',
      'dist/',
      '',
    ].join('\n'), 'utf8');

    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });

    const gitignore = fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain(KIT_BLOCK_BEGIN);
    expect(gitignore).toContain('.claude/settings.json');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).toContain('dist/');
    expect(gitignore).not.toContain('.claude/\n');
    expect(lock(tmpDir).gitMode).toBe('gitignore');
  });

  it('update with git-exclude refreshes exclude without touching .gitignore', async () => {
    gitInit(tmpDir);
    await cmdInit(['--gitignore'], { targetDir: tmpDir, kitDir: KIT_DIR });
    const beforeGitignore = fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8');

    await cmdUpdate(['--git-exclude'], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8')).toBe(beforeGitignore);
    expect(fs.readFileSync(file(tmpDir, '.git/info/exclude'), 'utf8')).toContain(KIT_BLOCK_BEGIN);
    expect(lock(tmpDir).gitMode).toBe('git-exclude');
  });

  it('update does not overwrite existing untracked kit-managed paths', async () => {
    gitInit(tmpDir);
    fs.mkdirSync(file(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(file(tmpDir, '.claude/settings.json'), 'local settings\n', 'utf8');
    fs.writeFileSync(file(tmpDir, LOCK_FILE), JSON.stringify({
      version: '0.1.0',
      gitMode: 'gitignore',
      files: {},
    }, null, 2) + '\n');

    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.readFileSync(file(tmpDir, '.claude/settings.json'), 'utf8')).toBe('local settings\n');
    expect(lock(tmpDir).files['.claude/settings.json']).toBeUndefined();
    expect(fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8')).not.toContain('.claude/settings.json');
  });

  it('update preserves locally modified kit-managed files', async () => {
    await cmdInit(['--git-track'], { targetDir: tmpDir, kitDir: KIT_DIR });
    fs.writeFileSync(file(tmpDir, '.claude/settings.json'), '{"changed": true}\n', 'utf8');

    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.readFileSync(file(tmpDir, '.claude/settings.json'), 'utf8')).toBe('{"changed": true}\n');
  });

  it('update removes obsolete unmodified kit-managed files', async () => {
    await cmdInit(['--git-track'], { targetDir: tmpDir, kitDir: KIT_DIR });
    const obsolete = file(tmpDir, '.claude/obsolete.md');
    fs.writeFileSync(obsolete, 'obsolete\n', 'utf8');
    const currentLock = readLock(tmpDir);
    currentLock.files['.claude/obsolete.md'] = {
      ownership: 'kit-managed',
      hash: hashFile(obsolete),
    };
    writeLock(tmpDir, currentLock);

    await cmdUpdate([], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.existsSync(obsolete)).toBe(false);
    expect(lock(tmpDir).files['.claude/obsolete.md']).toBeUndefined();
  });

  it('uninstall keeps modified user-owned files in non-interactive --all and cleans git blocks', async () => {
    gitInit(tmpDir);
    await cmdInit(['--gitignore'], { targetDir: tmpDir, kitDir: KIT_DIR });
    fs.writeFileSync(file(tmpDir, 'CLAUDE.md'), 'local project notes\n', 'utf8');

    await cmdUninstall(['--all'], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.existsSync(file(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(file(tmpDir, LOCK_FILE))).toBe(true);
    expect(fs.readFileSync(file(tmpDir, '.gitignore'), 'utf8')).not.toContain(KIT_BLOCK_BEGIN);
  });

  it('uninstall removes kit-managed files by default and keeps user-owned files', async () => {
    await cmdInit(['--git-track'], { targetDir: tmpDir, kitDir: KIT_DIR });

    await cmdUninstall([], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.existsSync(file(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(file(tmpDir, '.claude/settings.json'))).toBe(false);
    expect(fs.existsSync(file(tmpDir, LOCK_FILE))).toBe(false);
  });

  it('uninstall --all --force removes modified user-owned files', async () => {
    await cmdInit(['--git-track'], { targetDir: tmpDir, kitDir: KIT_DIR });
    fs.writeFileSync(file(tmpDir, 'CLAUDE.md'), 'local project notes\n', 'utf8');

    await cmdUninstall(['--all', '--force'], { targetDir: tmpDir, kitDir: KIT_DIR });

    expect(fs.existsSync(file(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(file(tmpDir, LOCK_FILE))).toBe(false);
  });

  it('subcommand help does not run install', async () => {
    const lockExisted = fs.existsSync(file(process.cwd(), LOCK_FILE));
    await main(['init', '--help']);

    expect(fs.existsSync(file(process.cwd(), LOCK_FILE))).toBe(lockExisted);
  });
});
