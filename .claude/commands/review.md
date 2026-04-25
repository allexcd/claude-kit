---
description: Review code changes — current branch diff or a specified PR number.
argument-hint: [PR number or branch name, optional]
---

Review the changes in: **$ARGUMENTS** (if blank, use `git diff main...HEAD` for the current branch).

## Instructions
1. Get the diff:
   - If $ARGUMENTS is a PR number:
     - Try `gh pr diff $ARGUMENTS` (requires the [GitHub CLI](https://cli.github.com/))
     - If `gh` is not available or this is not a GitHub repo, tell the user: "Install `gh` and run `gh auth login`, or check out the branch locally and re-run `/review <branch>`"
   - If $ARGUMENTS is a branch name, run `git diff $ARGUMENTS...HEAD`
   - If no argument, run `git diff main...HEAD`
2. For each changed file, assess:
   - **Correctness** — logic errors, edge cases, off-by-ones, null/undefined handling
   - **Security** — injection vectors, auth bypass, secret exposure, unvalidated input
   - **Quality** — is this a root-cause fix or a band-aid? dead code, unnecessary duplication
   - **Tests** — are changes covered? do existing tests still accurately reflect behavior?
3. Rate overall confidence: `HIGH` / `MEDIUM` / `LOW`
4. Separate blocking issues (must fix before merge) from suggestions (nice to have)

## Return Format
```
Confidence: HIGH | MEDIUM | LOW

Blocking
- [ ] <issue> — <file>:<line>

Suggestions
- [ ] <suggestion> — <file>:<line>

Looks Good
- <what was done well>
```
