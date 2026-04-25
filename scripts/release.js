#!/usr/bin/env node
'use strict';

// Local release helper for claude-workspace-kit.
//
// What it does:
//   1. Guards — clean working tree, lint passes, tests pass
//   2. Shows commits since the last tag and suggests a bump type
//   3. Prompts for patch / minor / major
//   4. Previews the npm package contents (npm pack --dry-run)
//   5. Bumps package.json version (no local git tag — CI creates that on merge)
//   6. Commits the bump with a conventional commit message
//   7. Pushes to a release branch and opens a PR (requires gh CLI), or prints next steps
//
// Usage: npm run release

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

// ── helpers ───────────────────────────────────────────────────────────────────

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function runVisible(cmd) {
  const result = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: ROOT });
  return result.status === 0;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function ok(msg)   { console.log(`  ✓  ${msg}`); }
function fail(msg) { console.error(`  ✗  ${msg}`); process.exit(1); }
function info(msg) { console.log(`  ${msg}`); }
function section(msg) { console.log(`\n  ${msg}`); }

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function suggestBump(commits) {
  if (!commits) return 'patch';
  const lines = commits.split('\n');
  if (lines.some(c => /BREAKING[ -]CHANGE|^[^:]+!:/.test(c))) return 'major';
  if (lines.some(c => /^feat[:(]/.test(c))) return 'minor';
  return 'patch';
}

function ghAvailable() {
  try { run('gh --version'); return true; } catch { return false; }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  claude-workspace-kit — release helper');
  console.log('  =====================================');

  // 1. Clean working tree
  section('Checking working tree...');
  const dirty = run('git status --porcelain');
  if (dirty) {
    fail(`Working tree has uncommitted changes. Commit or stash them first.\n\n${dirty.split('\n').map(l => `    ${l}`).join('\n')}`);
  }
  ok('Working tree is clean');

  // 2. Lint
  section('Running lint...');
  if (!runVisible('npm run lint --silent')) fail('Lint failed. Fix errors before releasing.');
  ok('Lint passed');

  // 3. Tests
  section('Running tests...');
  if (!runVisible('npm test')) fail('Tests failed. Fix before releasing.');
  ok('Tests passed');

  // 4. Show commits since last tag
  let lastTag;
  try { lastTag = run('git describe --tags --abbrev=0'); } catch { lastTag = null; }

  const logRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
  const commits = (() => { try { return run(`git log ${logRange} --format="%s"`); } catch { return ''; } })();

  section(lastTag ? `Changes since ${lastTag}:` : 'All commits (no previous tag found):');

  if (!commits) {
    info('⚠  No new commits since last tag.');
    const ans = await prompt('\n  Continue anyway? [y/N] ');
    if (!/^y/i.test(ans)) { console.log('\n  Aborted.\n'); process.exit(0); }
  } else {
    commits.split('\n').forEach(c => info(`  • ${c}`));
  }

  // 5. Suggest bump type
  const suggested = suggestBump(commits);
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const current = pkg.version;

  console.log(`\n  Current version : ${current}`);
  console.log(`  Suggested bump  : ${suggested}  (${bumpVersion(current, suggested)})\n`);
  info('[1] patch  — backwards-compatible bug fixes');
  info('[2] minor  — new features, backwards-compatible');
  info('[3] major  — breaking changes');

  const choice = await prompt('\n  Bump type [1/2/3] or Enter to accept suggestion: ');
  const bumpMap = { '': suggested, '1': 'patch', '2': 'minor', '3': 'major' };
  const bump = bumpMap[choice];
  if (!bump) fail(`Invalid choice: "${choice}"`);

  const newVersion = bumpVersion(current, bump);
  console.log(`\n  Will bump: ${current} → ${newVersion}`);

  // 6. Preview package contents
  section('Previewing npm publish contents (npm pack --dry-run)...\n');
  runVisible('npm pack --dry-run');

  // 7. Confirm
  console.log('');
  const confirm = await prompt(`  Bump to ${newVersion} and commit? [y/N] `);
  if (!/^y/i.test(confirm)) { console.log('\n  Aborted.\n'); process.exit(0); }

  // 8. Bump version (--no-git-tag-version: CI creates the tag on merge)
  section(`Bumping version to ${newVersion}...`);
  run(`npm version ${bump} --no-git-tag-version`);
  ok(`package.json updated to ${newVersion}`);

  // 9. Commit
  section('Committing...');
  run('git add package.json package-lock.json');
  run(`git commit -m "chore(release): bump version to ${newVersion}"`);
  ok(`chore(release): bump version to ${newVersion}`);

  const prTitle = `chore(release): bump version to ${newVersion}`;
  const releaseBranch = `chore/release-${newVersion}`;

  // 10. Push + PR
  const pushAns = await prompt(`\n  Push to '${releaseBranch}' and open a PR? [y/N] `);

  if (/^y/i.test(pushAns)) {
    section(`Pushing to ${releaseBranch}...`);
    run(`git checkout -b ${releaseBranch}`);
    run(`git push origin ${releaseBranch}`);
    ok(`Pushed to origin/${releaseBranch}`);

    if (ghAvailable()) {
      section('Opening PR...');
      try {
        run(`gh pr create --title "${prTitle}" --base main --body "Bump version to ${newVersion}. Merging to main will trigger the automated tag and npm publish workflow."`);
        ok(`PR opened: ${prTitle}`);
      } catch {
        info(`⚠  Could not open PR automatically. Open one manually from '${releaseBranch}'.`);
      }
    } else {
      info('gh CLI not found — open the PR manually.');
    }
  } else {
    console.log(`\n  Next steps:`);
    info(`1. git checkout -b ${releaseBranch} && git push origin ${releaseBranch}`);
    info('2. Open a PR to main');
    info('3. Once merged, CI will create the tag and publish to npm automatically');
  }

  console.log(`\n  Suggested PR title: \`${prTitle}\``);
  console.log('\n  Done.\n');
}

main().catch(e => {
  console.error('\n  Unexpected error:', e.message);
  process.exit(1);
});
