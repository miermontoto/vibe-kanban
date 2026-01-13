# Repository Guidelines

## Project Identity

**vkm** - An independent fork of BloopAI/vibe-kanban with additional features and customizations.

## Git Workflow & Repository Management

- **Primary repository**: https://github.com/miermontoto/vibe-kanban
- This is a fork that has diverged significantly from upstream
- Maintain independence from upstream - do not automatically sync or create PRs to upstream
- Remote setup:
  - `origin`: https://github.com/miermontoto/vibe-kanban (PRIMARY)
  - `upstream`: https://github.com/BloopAI/vibe-kanban.git (reference only)

## Project Structure & Module Organization

- `crates/`: Rust workspace crates — `server` (API + bins), `db` (SQLx models/migrations), `executors`, `services`, `utils`, `deployment`, `local-deployment`, `remote`.
- `frontend/`: React + TypeScript app (Vite, Tailwind). Source in `frontend/src`.
- `frontend/src/components/dialogs`: Dialog components for the frontend.
- `remote-frontend/`: Remote deployment frontend.
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
- Prepare SQLx (remote package, postgres): `pnpm run remote:prepare-db`
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
