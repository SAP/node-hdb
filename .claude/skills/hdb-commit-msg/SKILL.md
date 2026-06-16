---
name: hdb-commit-msg
description: Use when creating a new commit, making a commit, committing changes, or writing a commit message in node-hdb.
---

# hdb-commit-msg

Generates a well-formatted git commit message for node-hdb following project conventions. Always confirms the message with the user before committing.

## When to Use This Skill

- User asks to make a new commit or commit changes
- User asks to write or generate a commit message
- User says "let's commit", "I want to commit", "commit this", or similar
- User asks to amend a commit or update a commit message

## Workflow

1. Run `git status` to check staged and unstaged changes
2. **Determine what to commit:**
   - **Staged files exist:** use them as-is
   - **No staged files, user specified files explicitly:** stage those files with `git add`
   - **No staged files, user described the change:** infer relevant files from the description and `git status`, show them, and ask — "I'll stage these files: `[list]`. Does that look right?" — wait for confirmation, then stage
   - **No staged files, no files or description mentioned:** stage all changed files with `git add -A`
3. Run `git diff --staged` to analyze the staged changes
4. Infer the commit type from the diff (see [Types](#types) below)
5. Use no scope by default unless the user specifies one
6. Draft the commit message (header + body)
7. Show the full message, then ask:

   **"Does this commit message look good?"**
   1. Yes, commit
   2. Suggest changes

8. On option 1, commit using a heredoc to preserve formatting:

   ```bash
   git commit -m "$(cat <<'EOF'
   [TYPE](optional-scope) <summary description>

   - <change 1>
   - <change 2>
   EOF
   )"
   ```
   On option 2, apply the suggestion, revise, and re-ask

## Commit Message Guidelines

### Format

```
[header line]

[body]
```

The header and body are separated by a blank line.

#### Header Line

```
[TYPE](optional-scope) <summary description> 
```

- No period at end of header line
- Brief and accurate; aim for under 72 characters but longer is fine if needed

Scope is optional. Examples from this repo:
- `[FEATURE](stmt distr) add topology update records in reply`
- `[INTERNAL] refactor vars to const/let in Connection.js`
- `[FIX] fix failing compression unit-test after removing packet size checking`

#### Body

Use bullet points to summarize notable changes — include what changed and why/benefit, skip trivial or self-explanatory edits.

```
- <change 1> [and why/benefit if non-obvious]
- <change 2> [and why/benefit if non-obvious]
```

Example:

```
- add SystemInfo class to store and update connection topology information
- remove redundant _connect() method from Connection as it's now handled by PhysicalConnection
```

### Types

Mutually exclusive — one per commit:

| Type | When to use |
|------|-------------|
| `FEATURE` | New feature visible to users or callers |
| `FIX` | Bug fix |
| `TEST` | Adding or updating tests only |
| `DOC` | README.md changes only |
| `INTERNAL` | Non-functional changes, refactoring, comments |
| `RELEASE` | Version bumps, release assembly |
| `INFRA` | Build or test infrastructure only |

### Rules

- Imperative mood throughout — use the base verb form for header and every body bullet (e.g., "add" not "added"/"adds", "remove" not "removed"/"removes")
- No AI attribution footers (`Co-Authored-By: Claude`, `🤖 Generated with...`)

## Interactive Prompts

- **Scope:** No scope by default; only include if the user specifies one
- **Breaking changes:** If the diff suggests a breaking API/behavior change, ask the user to confirm, then include `(BREAKING CHANGE)` on its own line in the body
- **Multi-area changes:** If changes span clearly unrelated areas, suggest splitting into multiple commits before proceeding
