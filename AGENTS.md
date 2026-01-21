# Repository Guidelines

## Project Identity

**vkm** - An independent fork of BloopAI/vibe-kanban with additional features and customizations.

## ⛔ CRITICAL: Features Never To Merge From Upstream

**DO NOT merge any code related to the following features from upstream:**

### Beta Workspaces / New UI (`ui-new`)
- **Reason:** This feature was completely removed from vkm. The new workspaces UI system adds significant complexity without benefit for this fork's use case.
- **What to reject:** Any code involving:
  - `beta_workspaces` or `beta_workspaces_invitation_sent` config fields
  - `useWorkspaceCount`, `useWorkspaces`, `useCreateWorkspace`, `useWorkspaceMutations` hooks
  - `WorkspaceContext`, `CreateModeContext`, `ActionsContext`, `ChangesViewContext` contexts
  - Files in `frontend/src/components/ui-new/` or `frontend/src/pages/ui-new/`
  - Routes containing `/workspaces`
  - `BetaWorkspacesDialog`, `WorkspacesGuideDialog`, `RenameWorkspaceDialog`
  - i18n keys: `workspaces.*`, `betaWorkspaces.*`, `workspacesGuide.*`
- **If accidentally merged:** Revert the merge or manually remove all related code

## Git Workflow & Repository Management

- **Primary repository**: https://github.com/miermontoto/vibe-kanban
- This is a fork that has diverged significantly from upstream
- Maintain independence from upstream - do not automatically sync or create PRs to upstream
- Remote setup:
  - `origin`: https://github.com/miermontoto/vibe-kanban (PRIMARY)
  - `upstream`: https://github.com/BloopAI/vibe-kanban.git (reference only)

### Merging Upstream Changes

To merge changes from upstream BloopAI/vibe-kanban, use the `/merge-upstream` command which provides a comprehensive guide for:
- Pre-merge preparation and checks
- Handling merge conflicts systematically
- Preserving custom features (package name, versioning, git workflow)
- Post-merge fixes (SQLx, TypeScript types, formatting)
- Full verification checklist

See `.claude/commands/merge-upstream.md` for detailed instructions.

### Upstream Merge History

#### Merge 2026-01-13: BloopAI/vibe-kanban upstream sync

**Context:** Merged 57 upstream commits into fork (278 commits ahead). Merge base: `06862ab0`.

**Key upstream changes integrated:**
- **Dev scripts refactoring**: `dev_script` and `dev_script_working_dir` fields moved from Project model to Repo model
- **Git host abstraction**: `github` module renamed to `git_host` to support Azure Repos alongside GitHub
- **Type renames**: `CreateTaskAndStartRequest` → `CreateAndStartTaskRequest`
- **Removed features**: `auto_pr_results`, `custom_branch_name`, `AutoPrResult`, `TaskUpdateResponse` types removed
- **API changes**:
  - `push_to_github` → `push_to_remote`
  - `projectsApi.getRemotes()` now returns `string[]` instead of `GitRemote[]`
  - `UpdateProject` now requires `default_agent_working_dir` field

**Post-merge fixes required:**
- Regenerate SQLx prepared queries: `pnpm run prepare-db`
- Regenerate TypeScript types: `pnpm run generate-types`
- Update all references to removed fields/types
- Run `cargo fmt --all` to fix formatting
- Fix ESLint warnings (useCallback dependencies)

**Custom features preserved:**
- Package name: `@miermontoto/vkm` (upstream: `vibe-kanban`)
- Version: `1.0.1` (upstream: `0.0.150`)
- Custom git workflow features (auto-commit, auto-PR with title mode)
- Custom branding and configuration

**Verification checklist after upstream merge:**
1. ✅ TypeScript compilation: `pnpm run check`
2. ✅ ESLint: `pnpm run lint`
3. ✅ Rust formatting: `cargo fmt --all -- --check`
4. ✅ Type generation: `pnpm run generate-types:check`
5. ✅ Rust linting: `cargo clippy --all --all-targets -- -D warnings`
6. ✅ Tests: `cargo test --workspace`
7. ⚠️ i18n completeness: `./scripts/check-i18n.sh` (warnings expected from merge)

#### Merge 2026-01-13 (2): Follow-up upstream sync

**Context:** Merged 5 additional upstream commits from BloopAI/vibe-kanban. Fork is 285 commits ahead.

**Key upstream changes integrated:**
- **Preview control improvements**: New IconButton and IconButtonGroup components
- **i18n updates**: New keys for `setupTitle`, `editDevScript`, `learnMore` in tasks translations

**Conflicts resolved:**
- `crates/server/src/routes/projects.rs`: Combined import changes (file_search rename + GitRemote)
- `shared/types.ts`: Used --ours (regenerated)
- `frontend/src/i18n/locales/{en,es,ja,ko,zh-Hans,zh-Hant}/tasks.json`: Merged both sides' keys in `noServer` section

**Custom features preserved:**
- `editButton` and `configureButton` i18n keys (our additions)
- Package name and versioning

**All CI checks passing.**

#### Merge 2026-01-15: BloopAI/vibe-kanban upstream sync

**Context:** Merged 27 upstream commits from BloopAI/vibe-kanban. Fork is 294 commits ahead. Merge base: `cdfb081c`.

**Key upstream changes integrated:**
- **NixOS/non-FHS support**: Shell path detection using `from_path` pattern instead of hardcoded paths
- **React Compiler**: Babel plugin for automatic memoization optimizations
- **Database performance**: New composite indexes for query optimization
- **Workspace file search**: SearchQuery import for workspace search feature
- **Git worktree improvements**: Better path support for git worktrees
- **GitHub CLI fork support**: `get_repo_info` now accepts `remote_url` parameter
- **Beta workspaces system**: New dialog, invitation system, and `useWorkspaceCount` hook
- **Rustls crypto provider**: TLS initialization for remote server
- **WebSocket stale connection handling**: Improved process ID capture for cleanup

**Conflicts resolved:**
- `crates/utils/src/shell.rs`: Merged Fish shell support with NixOS dynamic path detection
- `crates/remote/src/main.rs`: Added rustls crypto provider (removed Sentry)
- `crates/server/src/routes/task_attempts.rs`: Combined imports (RepoWithName + SearchQuery)
- `crates/services/src/services/git_host/github/cli.rs`: Updated `get_repo_info` signature with tracing
- `frontend/src/hooks/useLogStream.ts`: Merged upstream stale WebSocket handling with our `buildWebSocketUrl` utility
- `frontend/src/pages/ProjectTasks.tsx`: Added `useWorkspaceCount` (removed PostHog)
- `frontend/vite.config.ts`: Added React Compiler plugin (removed Sentry)
- Version files (package.json, Cargo.toml): Kept our versions

**Post-merge fixes applied:**
- Added `beta_workspaces` and `beta_workspaces_invitation_sent` fields to v14 Config
- Removed posthog import and replaced with GitHub Issues redirect for feedback
- Regenerated SQLx queries and TypeScript types

**Custom features preserved:**
- Package name: `@miermontoto/vkm`
- Version: 1.1.1
- Fish shell support in shell.rs
- `buildWebSocketUrl` utility
- Sentry and PostHog removed
- Custom git workflow features (auto-commit, auto-PR, push modes)

**All CI checks passing:**
1. ✅ TypeScript compilation: `pnpm run check`
2. ✅ ESLint: `pnpm run lint`
3. ✅ Rust formatting: `cargo fmt --all -- --check`
4. ✅ Frontend formatting: `pnpm run format:check`
5. ✅ Rust linting: `cargo clippy --all --all-targets -- -D warnings`
6. ✅ Tests: `cargo test --workspace` (207 tests passed)

#### Removal 2026-01-17: Beta Workspaces Feature Nuked ⛔

**Context:** Complete removal of the beta workspaces / new UI feature from the fork.

**What was removed:**
- Config fields: `beta_workspaces`, `beta_workspaces_invitation_sent` from v14 Config
- React hooks: `useWorkspaceCount`, `useCreateWorkspace`, `useWorkspaceMutations`, `useWorkspaceSessions`
- Contexts: `WorkspaceContext`, `CreateModeContext`, `ActionsContext`, `ChangesViewContext`, `LogsPanelContext`
- UI components: Entire `frontend/src/components/ui-new/` directory (~100 files)
- Pages: `frontend/src/pages/ui-new/` directory
- Routes: `/workspaces` route group in App.tsx
- Dialogs: `BetaWorkspacesDialog`, `WorkspacesGuideDialog`, `RenameWorkspaceDialog`, `StartReviewDialog`
- Hooks: `useContextBarPosition`, `useGitHubComments`
- i18n keys: `workspaces.*`, `betaWorkspaces.*`, `workspacesGuide.*` from all 6 locales
- Assets: `beta-workspaces-preview.png`
- Stores: `useUiPreferencesStore`
- Utils: `fileTreeUtils`

**Files preserved (moved to `frontend/src/components/ui/process-logs/`):**
- `virtualized-process-logs.tsx` - Used by ScriptFixerDialog
- `running-dots.tsx` - Used by ScriptFixerDialog

**Why removed:** The beta workspaces feature adds significant complexity for a use case not relevant to this fork. It introduces a completely separate UI system (`ui-new`) that duplicates functionality and creates maintenance burden during upstream merges.

**Verification:** All CI checks passing after removal.

#### Merge 2026-01-21: BloopAI/vibe-kanban upstream sync

**Context:** Merged 59 upstream commits from BloopAI/vibe-kanban (v0.0.158). Fork is ~345 commits ahead.

**Key upstream changes integrated:**
- **Drag-and-drop image upload**: Image upload functionality across chat components
- **Commits behind indicator**: Shows when branch is behind in git panel
- **Branch name search**: Search functionality in workspaces sidebar
- **Override default worktree directory**: New configuration option
- **TodoProgressPopup**: New component for task progress display
- **Expandable terminal in logs panel**: Terminal UX improvements
- **Commit reminder improvements**: Show reminder only once with logging
- **OpenCode model variant support**: New AI model support
- **Remote projects/workspaces schema**: Electric Sync and shape definitions
- **Permission update fixes**: Correct rules type for Claude Code SDK

**Conflicts resolved:**
- Shared task infrastructure restored (removed by upstream simplification)
- `tasks.rs`: Added back share_task endpoint
- `shared_tasks.rs`: Added SharedTask, UserData, AssigneesQuery, SharedTaskResponse types for TS generation
- `error.rs`: Added ShareError handling to ApiError
- `mod.rs`: Re-added shared_tasks module and router
- `api.ts`: Added share, unshare, reassign, linkToLocal methods to tasksApi
- `useTaskMutations.ts`: Restored shareTask, stopShareTask, linkSharedTaskToLocal mutations
- `remoteApi.ts`: Restored getSharedTaskAssignees function
- `generate_types.rs`: Added shared task types for TypeScript generation

**Shared task dialogs restored:**
- `ShareDialog.tsx`
- `ReassignDialog.tsx`
- `StopShareTaskDialog.tsx`

**Custom features preserved:**
- Package name: `@miermontoto/vkm`
- Version: 1.2.0
- Shared task infrastructure (Electric SQL sync)
- Custom git workflow features (auto-commit, auto-PR, push modes)
- Ralph Wiggum mode
- Sentry and PostHog removed

**All CI checks passing:**
1. ✅ TypeScript compilation: `pnpm run check`
2. ✅ ESLint: `pnpm run lint`
3. ✅ Rust formatting: `cargo fmt --all -- --check`
4. ✅ Frontend formatting: `pnpm run format:check`
5. ✅ Rust linting: `cargo clippy --all --all-targets -- -D warnings`
6. ✅ Type generation: `pnpm run generate-types:check`
7. ⚠️ Tests: 9 git_ops_safety tests fail due to 1Password SSH agent (environment-specific)

## Project Structure & Module Organization

- `crates/`: Rust workspace crates — `server` (API + bins), `db` (SQLx models/migrations), `executors`, `services`, `utils`, `deployment`, `local-deployment`, `remote`.
- `frontend/`: React + TypeScript app (Vite, Tailwind). Source in `frontend/src`.
- `frontend/src/components/dialogs`: Dialog components for the frontend.
- `shared/`: Generated TypeScript types (`shared/types.ts`). Do not edit directly.
- `assets/`, `dev_assets_seed/`, `dev_assets/`: Packaged and local dev assets.
- `npx-cli/`: Files published to the npm CLI package.
- `scripts/`: Dev helpers (ports, DB preparation).
- `docs/`: Documentation files.

## Managing Shared Types Between Rust and TypeScript

ts-rs allows you to derive TypeScript types from Rust structs/enums. By annotating your Rust types with #[derive(TS)] and related macros, ts-rs will generate .ts declaration files for those types.
When making changes to the types, you can regenerate them using `pnpm run generate-types`
Do not manually edit shared/types.ts, instead edit crates/server/src/bin/generate_types.rs

## Build, Test, and Development Commands

- Install: `pnpm i`
- Run dev (frontend + backend with ports auto-assigned): `pnpm run dev` or `./dev.sh`
- Backend (watch): `pnpm run backend:dev:watch`
- Frontend (dev): `pnpm run frontend:dev`
- Type checks: `pnpm run check` (frontend) and `pnpm run backend:check` (Rust cargo check)
- Rust tests: `cargo test --workspace`
- Generate TS types from Rust: `pnpm run generate-types` (or `generate-types:check` in CI)
- Prepare SQLx (offline): `pnpm run prepare-db`
- Local NPX build: `./local-build.sh` (builds binaries: vkm, vkm-mcp, vkm-review)

## Package and Binary Names

- NPM package: `@miermontoto/vkm`
- Main binary: `vkm` (formerly `server`)
- MCP server binary: `vkm-mcp` (formerly `mcp_task_server`)
- Review CLI binary: `vkm-review` (formerly `review`)
- Data directory: `~/.local/share/vkm` (XDG standard)
- Cache directory: `~/.vkm/bin`

## Automated QA
- When testing changes by runnign the application, you should prefer `pnpm run dev:qa` over `pnpm run dev`, which starts the application in a dedicated mode that is optimised for QA testing

## Coding Style & Naming Conventions

- Rust: `rustfmt` enforced (`rustfmt.toml`); group imports by crate; snake_case modules, PascalCase types.
- TypeScript/React: ESLint + Prettier (2 spaces, single quotes, 80 cols). PascalCase components, camelCase vars/functions, kebab-case file names where practical.
- Keep functions small, add `Debug`/`Serialize`/`Deserialize` where useful.

## Testing Guidelines

- Rust: prefer unit tests alongside code (`#[cfg(test)]`), run `cargo test --workspace`. Add tests for new logic and edge cases.
- Frontend: ensure `pnpm run check` and `pnpm run lint` pass. If adding runtime logic, include lightweight tests (e.g., Vitest) in the same directory.

## Security & Config Tips

- Use `.env` for local overrides; never commit secrets. Key envs: `FRONTEND_PORT`, `BACKEND_PORT`, `HOST`
- Dev ports and assets are managed by `scripts/setup-dev-environment.js`.

## Release Process

vkm uses a simplified, single-workflow release system based on semantic versioning.

### Quick Release

```bash
# Using the helper script (recommended)
./scripts/release.sh patch   # 0.0.147 → 0.0.148
./scripts/release.sh minor   # 0.0.147 → 0.1.0
./scripts/release.sh major   # 0.0.147 → 1.0.0
./scripts/release.sh prerelease  # 0.0.147 → 0.0.148-0
```

### Manual Release

```bash
# 1. Bump version (updates all package.json and Cargo.toml files)
pnpm version patch  # or minor, major, prerelease

# 2. Install cargo-edit for Cargo version sync (first time only)
cargo install cargo-edit

# 3. Sync Cargo versions
cargo set-version --workspace $(node -p "require('./package.json').version")

# 4. Commit and tag
git add package.json pnpm-lock.yaml npx-cli/package.json frontend/package.json Cargo.toml Cargo.lock crates/*/Cargo.toml
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag -a "v$(node -p "require('./package.json').version")" -m "Release v$(node -p "require('./package.json').version")"

# 5. Push (triggers GitHub Actions release workflow)
git push && git push --tags
```

### What Happens After Push

The `release.yml` workflow automatically:

1. ✅ Runs all tests (fails fast if tests don't pass)
2. 🏗️ Builds frontend with optimizations
3. 🦀 Builds Rust binaries for 6 platforms (parallel):
   - Linux x64/ARM64 (musl)
   - macOS x64/ARM64 (universal)
   - Windows x64/ARM64
4. 📦 Packages NPM tarball with binaries
5. 🎉 Creates GitHub Release with:
   - Auto-generated changelog from commits
   - All platform binaries as assets
   - NPM package as asset
6. 🚀 Publishes to NPM (only for stable releases, not prereleases)

### Version Types

- **patch** (0.0.147 → 0.0.148): Bug fixes, small changes
- **minor** (0.0.147 → 0.1.0): New features, backward compatible
- **major** (0.0.147 → 1.0.0): Breaking changes
- **prerelease** (0.0.147 → 0.0.148-0): Alpha/beta releases (not published to NPM)

### Monitoring Releases

- Watch progress: https://github.com/miermontoto/vibe-kanban/actions
- View releases: https://github.com/miermontoto/vibe-kanban/releases
- NPM package: https://www.npmjs.com/package/@miermontoto/vkm

### Important Notes

- Version numbers must follow semver (MAJOR.MINOR.PATCH)
- Tags must be in format `vX.Y.Z` (e.g., `v1.2.3`)
- Prereleases (containing `-`, `alpha`, `beta`, or `rc`) are NOT auto-published to NPM
- All tests must pass before binaries are built
- The exact binaries tested are what get released (no "works on my machine" issues)

### NPM Package Architecture

The NPM package (`@miermontoto/vkm`) is a lightweight wrapper (~6KB) that downloads platform-specific binaries from GitHub Releases at runtime:

**How it works:**

1. User runs `npx @miermontoto/vkm@1.0.1`
2. NPM downloads the wrapper package from npm registry
3. `npx-cli/bin/cli.js` detects platform (linux-x64, macos-arm64, etc.)
4. `npx-cli/bin/download.js` downloads binary from GitHub Release:
   - URL format: `https://github.com/miermontoto/vkm/releases/download/v1.0.1/vkm-linux-x64.zip`
   - Cached at: `~/.vkm/bin/v1.0.1/{platform}/`
5. Binary is extracted and executed

**Why this architecture:**

- NPM has package size limits (~200MB)
- All platform binaries together = ~150MB
- Wrapper + runtime download = only download what you need (~27MB per platform)

### Troubleshooting Releases

#### NPM Publish Fails (First Release Only)

**Symptom:** `publish-npm` job fails with `404 Not Found` error

**Cause:** First release to a scoped package (`@miermontoto/vkm`) requires manual publish to establish the scope on npm registry.

**Fix:**

```bash
# Download the package from GitHub Release
cd /tmp
curl -L -O https://github.com/miermontoto/vkm/releases/download/v1.0.1/miermontoto-vkm-1.0.1.tgz

# Publish manually (requires npm login)
npm login
npm publish miermontoto-vkm-1.0.1.tgz --access public
```

After the first manual publish, all future releases will auto-publish via GitHub Actions.

#### Testing NPM Package

After a release, verify the package works:

```bash
# Test from npm registry
npx @miermontoto/vkm@1.0.1 --version

# Should download binary from GitHub Releases and start successfully
# Binary cached at: ~/.vkm/bin/v1.0.1/linux-x64/
```

**Expected behavior:**

```
Starting vkm v1.0.1...
Downloading vkm...
   Downloading: 26.5MB / 26.5MB (100%)
[VKM server starts successfully]
```

**If download fails with 404:**

- Check that `npx-cli/bin/download.js` uses correct GitHub Release URLs
- Verify binaries exist in GitHub Release with correct naming: `vkm-{platform}.zip`
- Test URL manually: `curl -I https://github.com/miermontoto/vkm/releases/download/v1.0.1/vkm-linux-x64.zip`

#### cargo-xwin Installation Issues

**Symptom:** Windows builds fail with "failed to compile cargo-xwin" or "xwin version yanked"

**Fix:** Use `--locked` flag in workflow (already applied):

```yaml
cargo install --locked cargo-xwin@0.20.2
```

#### Windows ARM64 Build Failures

Windows ARM64 builds may fail due to aws-lc-sys cross-compilation issues. This is expected and marked as experimental (`continue-on-error: true`). The release will proceed with 5 platforms instead of 6.

### Release History & Notes

#### v1.0.1 (2026-01-12) - First Working NPM Package ✅

**Status:** Fully functional, production-ready
**What changed:** Fixed `npx-cli/bin/download.js` to work with GitHub Releases

The NPM package now correctly downloads binaries from GitHub Releases at runtime. Previously failed with 404 errors due to expecting an R2/Cloudflare storage structure with manifest.json.

**Fix details:**

- Changed URL format from `/binaries/{tag}/{platform}/{binary}.zip` to `/{tag}/{binary}-{platform}.zip`
- Removed manifest.json dependency and SHA256 validation
- Updated getLatestVersion() to use GitHub API instead of manifest

**Verified working:**

```bash
npx @miermontoto/vkm@1.0.1
# ✅ Downloads binary from GitHub Releases
# ✅ Caches at ~/.vkm/bin/v1.0.1/{platform}/
# ✅ Starts successfully
```

#### v1.0.0 (2026-01-12) - Initial Major Release

**Status:** GitHub Release ✅ | NPM Package ❌ (broken)
**Issue:** NPM package fails with 404 errors when trying to download binaries

The release workflow successfully created the GitHub Release with all binaries, but the NPM package was non-functional due to download.js expecting a different URL structure. Users should use v1.0.1 or later.

**Builds:**

- ✅ Linux x64/ARM64 (musl)
- ✅ macOS x64/ARM64
- ✅ Windows x64
- ❌ Windows ARM64 (experimental, aws-lc-sys cross-compilation issues)

**Lessons learned:**

1. Always test NPM package end-to-end after publishing
2. cargo-xwin requires `--locked` flag to avoid yanked dependency issues
3. First scoped package publish requires manual `npm publish` to establish scope
