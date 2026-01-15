# Merge Upstream Changes

Safely merge changes from the upstream BloopAI/vibe-kanban repository into the vkm fork while preserving all custom features and fixes.

## Overview

This fork (miermontoto/vibe-kanban) has diverged significantly from upstream with:
- Custom package name: `@miermontoto/vkm` (vs `vibe-kanban`)
- Custom version numbering: 1.x.x (vs 0.0.x)
- Custom features: git workflow enhancements, auto-commit, auto-PR, commit title modes
- Custom branding and configuration
- Independent release pipeline

## When to Merge

Merge upstream changes periodically to:
- Integrate bug fixes from upstream
- Adopt new features (Azure Repos support, etc.)
- Stay aligned with upstream improvements
- Reduce long-term divergence

**Recommended frequency:** Every 1-2 months or when significant upstream changes occur

## Pre-Merge Checklist

Before starting the merge:

### 1. Ensure Clean Working Directory
```bash
git status
# Should show: "nothing to commit, working tree clean"
```

If uncommitted changes exist:
```bash
# Commit or stash changes first
git add -A
git commit -m "wip: save work before upstream merge"
```

### 2. Verify Current State
```bash
# Check current version
node -p "require('./package.json').version"

# Check remote configuration
git remote -v
# Should show:
#   origin: https://github.com/miermontoto/vibe-kanban
#   upstream: https://github.com/BloopAI/vibe-kanban.git

# If upstream is not configured:
git remote add upstream https://github.com/BloopAI/vibe-kanban.git
```

### 3. Run Pre-Merge CI Checks
```bash
# Ensure everything passes before merge
pnpm run check        # TypeScript compilation
pnpm run lint         # ESLint
cargo fmt --all -- --check  # Rust formatting
cargo clippy --all --all-targets -- -D warnings  # Rust linting
cargo test --workspace  # Tests
```

Fix any issues before proceeding. Use `/fix-ci` if needed.

## Merge Process

### Step 1: Fetch Upstream Changes

```bash
# Fetch latest upstream changes
git fetch upstream

# View what's new in upstream
git log HEAD..upstream/main --oneline --graph --first-parent | head -30
```

### Step 2: Analyze Divergence

```bash
# Check how many commits differ
echo "Commits in our fork:"
git rev-list --count HEAD ^upstream/main

echo "Commits in upstream:"
git rev-list --count upstream/main ^HEAD

# Find merge base
git merge-base HEAD upstream/main
```

### Step 3: Choose Merge Strategy

**Option 1: Full Merge (Recommended)**
- Preserves complete history
- Shows all upstream changes
- Easier to track what was integrated
- May have more conflicts initially

```bash
git merge upstream/main --no-ff --no-commit
```

**Option 2: Cherry-pick Specific Commits**
- Only integrate specific fixes/features
- More control but more manual work
- Use when upstream has breaking changes you don't want

```bash
# List commits to cherry-pick
git log upstream/main --oneline --graph | head -20

# Cherry-pick specific commits
git cherry-pick <commit-hash>
```

**Option 3: Rebase (NOT Recommended for this fork)**
- Rewrites history - dangerous for published branches
- Loses track of merge points
- Can break existing PRs and deployments
- ⚠️ Only use for feature branches, never for main

### Step 4: Handle Merge Conflicts

After starting the merge, conflicts are expected. Handle them systematically:

#### Conflict Categories

**1. Version Conflicts (package.json, Cargo.toml)**
- **Resolution:** Keep our version numbers (1.x.x, not 0.0.x)
- **Package name:** Keep `@miermontoto/vkm` not `vibe-kanban`

```bash
# Accept our version for these files
git checkout --ours package.json
git checkout --ours frontend/package.json
git checkout --ours npx-cli/package.json
git checkout --ours Cargo.toml
git checkout --ours crates/*/Cargo.toml

# Then manually verify and fix any non-version changes
```

⚠️ **IMPORTANT:** When keeping our `package.json`, check if upstream added new
dependencies that are used by config files (like `vite.config.ts`). If upstream
added React Compiler, Babel plugins, or other build tools, you may need to add
those dependencies manually after the merge:

```bash
# Example: If vite.config.ts references React Compiler but package.json doesn't have it
cd frontend && pnpm add -D babel-plugin-react-compiler react-compiler-runtime
```

**2. SQLx Prepared Queries Conflicts**
- **Resolution:** Remove all `.sqlx/*.json` files, regenerate after merge

```bash
# Remove conflicted SQLx files
rm -rf crates/db/.sqlx/query-*.json

# Mark as resolved
git add crates/db/.sqlx/
```

**3. Translation Files (i18n)**
- **Resolution:** Merge both sides - combine translation keys
- ⚠️ **CRITICAL:** Run `pnpm run format` after resolving JSON conflicts to fix indentation

```bash
# For each conflicted translation file:
# 1. Open in editor
# 2. Combine keys from both <<< HEAD and >>> upstream
# 3. Remove conflict markers
# 4. Ensure valid JSON
# 5. IMPORTANT: Run formatter to fix whitespace issues

# After resolving all i18n conflicts:
cd frontend && pnpm run format

# Verify formatting passes (this is checked in CI!)
pnpm run format:check
```

**Common Issue:** When manually editing JSON during conflict resolution, leading whitespace
can be accidentally stripped. This causes CI to fail with "Format check frontend" error.
Always run Prettier after editing JSON files.

**4. Source Code Conflicts**
- **Resolution:** Carefully merge, preserving custom features

```bash
# Review each conflict
git diff --name-only --diff-filter=U

# For each file:
# 1. Open in editor
# 2. Understand both changes
# 3. Merge manually preserving custom features
# 4. Test the merged code
```

#### Custom Features to Preserve

When resolving conflicts, ensure these are preserved:

- ✅ Git workflow features (auto-commit, auto-PR, push modes)
- ✅ Commit title modes (AgentSummary, AiGenerated, Manual)
- ✅ Package name: `@miermontoto/vkm`
- ✅ Version: 1.x.x format
- ✅ Custom scripts in package.json
- ✅ Release workflow (release.yml)
- ✅ Binary names (vkm, vkm-mcp, vkm-review)

### Step 5: Complete the Merge

Once all conflicts are resolved:

```bash
# Stage all resolved files
git add -A

# Verify no conflicts remain
git status
# Should show: "All conflicts fixed but you are still merging"

# Complete the merge
git commit -m "$(cat <<'EOF'
merge: integrate upstream changes from BloopAI/vibe-kanban

Merged X commits from upstream while preserving custom features:
- Package name: @miermontoto/vkm
- Version: 1.x.x
- Custom git workflow features
- Custom branding and configuration

Custom features preserved:
- Auto-commit and auto-PR functionality
- Commit title modes
- Independent release pipeline

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

## Post-Merge Fixes

After completing the merge, several regeneration steps are required:

### 1. Regenerate pnpm Lockfile

If the merge included changes to `package.json` dependencies:

```bash
# CRITICAL: Regenerate lockfile to match package.json changes
pnpm install

# Verify lockfile is now in sync (this is what CI checks!)
# If this fails, CI will fail with ERR_PNPM_OUTDATED_LOCKFILE
```

**Why this matters:** CI runs with `--frozen-lockfile` by default, which requires
the lockfile to exactly match `package.json`. If upstream added/removed/changed
dependencies, you MUST run `pnpm install` before committing.

### 2. Regenerate SQLx Prepared Queries

```bash
# This is CRITICAL after merge - SQLx queries must be regenerated
pnpm run prepare-db

# Verify it worked
ls -la crates/db/.sqlx/query-*.json
```

### 3. Regenerate TypeScript Types

```bash
# Regenerate types from Rust structs
pnpm run generate-types

# Verify types are up to date
pnpm run generate-types:check
```

### 4. Fix Rust Compilation Errors

```bash
# Check for compilation errors
cargo check --workspace

# Common issues after upstream merge:
# - Field renames (dev_script → dev_server_script)
# - Module renames (github → git_host)
# - Type changes (UpdateProject fields)
# - Method signature changes

# Fix each error systematically
```

### 5. Fix TypeScript Compilation Errors

```bash
# Check TypeScript compilation
pnpm run check

# Common issues:
# - Type renames (CreateTaskAndStartRequest → CreateAndStartTaskRequest)
# - Removed types (AutoPrResult, TaskUpdateResponse)
# - Field changes (custom_branch_name removed)
# - Return type changes (getRemotes: GitRemote[] → string[])

# Fix each error
```

### 6. Fix Formatting

⚠️ **CRITICAL:** This step is essential after resolving i18n JSON conflicts!
Manually edited JSON files often have whitespace issues that will fail CI.

```bash
# Auto-fix Rust formatting
cargo fmt --all

# Auto-fix frontend formatting (MUST run after i18n conflict resolution!)
cd frontend && pnpm run format

# Verify both pass (these are checked in CI)
cargo fmt --all -- --check
cd frontend && pnpm run format:check
```

**Note:** If `format:check` fails, the release workflow will fail at "Format check frontend".
Always run `pnpm run format` before committing merge results.

### 7. Run All CI Checks

```bash
# TypeScript
pnpm run check

# ESLint
pnpm run lint

# Rust formatting
cargo fmt --all -- --check

# Type generation
pnpm run generate-types:check

# Clippy
cargo clippy --all --all-targets -- -D warnings

# Tests
cargo test --workspace

# i18n completeness (warnings are OK)
./scripts/check-i18n.sh
```

## Documentation Update

After successful merge, document it in CLAUDE.md:

```markdown
### Upstream Merge History

#### Merge YYYY-MM-DD: BloopAI/vibe-kanban upstream sync

**Context:** Merged X upstream commits into fork (Y commits ahead). Merge base: `<hash>`.

**Key upstream changes integrated:**
- List major features/fixes from upstream
- Module refactorings
- New capabilities added

**Post-merge fixes required:**
- Regenerate SQLx prepared queries: `pnpm run prepare-db`
- Regenerate TypeScript types: `pnpm run generate-types`
- Fix compilation errors (details...)

**Custom features preserved:**
- Package name: `@miermontoto/vkm`
- Version: X.Y.Z
- Git workflow features
- [List specific preserved features]

**Verification checklist after upstream merge:**
1. ✅ TypeScript compilation: `pnpm run check`
2. ✅ ESLint: `pnpm run lint`
3. ✅ Rust formatting: `cargo fmt --all -- --check`
4. ✅ Type generation: `pnpm run generate-types:check`
5. ✅ Rust linting: `cargo clippy --all --all-targets -- -D warnings`
6. ✅ Tests: `cargo test --workspace`
7. ⚠️ i18n completeness: `./scripts/check-i18n.sh` (warnings expected)
```

## Troubleshooting

### Too Many Conflicts

If you encounter 50+ conflicts:

```bash
# Abort the merge
git merge --abort

# Try smaller chunks:
# 1. Merge to an intermediate upstream commit
git merge <intermediate-commit-hash>

# 2. Fix conflicts and commit
# 3. Merge to the next intermediate commit
# 4. Repeat until fully merged
```

### Database Migration Issues

If migrations conflict or fail:

```bash
# Check migration status
sqlite3 ~/.local/share/vkm/db.sqlite ".schema" | grep -A 5 "_sqlx_migrations"

# If needed, manually apply migrations
sqlx migrate run --source crates/db/migrations --database-url "sqlite://$HOME/.local/share/vkm/db.sqlite"
```

### Build Failures After Merge

If builds fail after merge:

```bash
# Clean build artifacts
cargo clean
rm -rf target/
rm -rf frontend/node_modules/.vite/

# Rebuild everything
pnpm install
cargo build
```

### Type Mismatches

If TypeScript types don't match Rust:

```bash
# Force regenerate types
rm shared/types.ts
pnpm run generate-types

# Check what changed
git diff shared/types.ts
```

## Best Practices

### DO:
- ✅ Commit frequently during conflict resolution
- ✅ Test after resolving each category of conflicts
- ✅ Preserve all custom features explicitly
- ✅ Document what was merged in CLAUDE.md
- ✅ Run full CI checks before committing
- ✅ Create a test release after merge (prerelease)

### DON'T:
- ❌ Force push to main (never)
- ❌ Accept all "ours" or all "theirs" blindly
- ❌ Skip SQLx/type regeneration steps
- ❌ Merge without clean working directory
- ❌ Skip testing after merge
- ❌ Forget to update CLAUDE.md

## Example Workflow

Complete example of a successful merge:

```bash
# 1. Prepare
git status  # Ensure clean
git fetch upstream

# 2. Analyze
git log HEAD..upstream/main --oneline | wc -l
# Output: 57 commits to merge

# 3. Start merge
git merge upstream/main --no-ff --no-commit

# 4. Handle conflicts systematically
# - Keep our versions (package.json, Cargo.toml)
git checkout --ours package.json frontend/package.json npx-cli/package.json
git checkout --ours Cargo.toml crates/*/Cargo.toml

# - Remove SQLx files for regeneration
rm -rf crates/db/.sqlx/query-*.json

# - Merge i18n files manually
# - Fix source code conflicts

# 5. Complete merge
git add -A
git commit -m "merge: integrate 57 upstream commits"

# 6. Post-merge fixes
pnpm install             # CRITICAL: sync lockfile with any dependency changes
pnpm run prepare-db
pnpm run generate-types
cargo fmt --all
cd frontend && pnpm run format

# 7. Fix compilation errors
cargo check --workspace  # Fix any Rust errors
pnpm run check          # Fix any TypeScript errors

# 8. Run all checks
pnpm run lint
cargo clippy --all --all-targets -- -D warnings
cargo test --workspace

# 9. Update documentation
# Edit CLAUDE.md to document the merge

# 10. Commit fixes
git add -A
git commit -m "fix: post-merge compilation and formatting fixes"

# 11. Test locally
pnpm run dev  # Verify app works

# 12. Push
git push

# 13. Create test release (optional but recommended)
./scripts/release.sh prerelease
```

## After Merge: Release New Version

After successfully merging and testing:

```bash
# Create a new release to publish the merged changes
./scripts/release.sh minor  # or patch, depending on changes

# This will:
# 1. Bump version
# 2. Run CI checks
# 3. Create release tag
# 4. Trigger GitHub Actions workflow
# 5. Build and publish to NPM
```

## Recovery

If something goes wrong:

### Abort Merge
```bash
git merge --abort
# Returns to pre-merge state
```

### Reset After Bad Commit
```bash
# If you committed but want to redo
git reset --hard HEAD~1
# ⚠️ Only if not pushed yet
```

### Restore Specific Files
```bash
# If you accidentally lost custom changes
git checkout HEAD~1 -- path/to/file
```

## Useful Commands

```bash
# View merge status
git status

# List conflicted files
git diff --name-only --diff-filter=U

# Show conflict markers in a file
git diff path/to/file

# View differences for all conflicts
git diff --check

# Accept ours for a file
git checkout --ours path/to/file

# Accept theirs for a file
git checkout --theirs path/to/file

# View upstream commits not in our branch
git log --oneline --graph HEAD..upstream/main

# View our commits not in upstream
git log --oneline --graph upstream/main..HEAD

# Find merge base
git merge-base HEAD upstream/main

# View what files changed in upstream
git diff --name-only HEAD...upstream/main

# Count conflicts remaining
git diff --name-only --diff-filter=U | wc -l
```

## See Also

- `/release` - Create a new release after merge
- `/fix-ci` - Fix all CI issues
- `/check-release` - Monitor release workflow
- CLAUDE.md - Project documentation and merge history
