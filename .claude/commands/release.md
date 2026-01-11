---
description: Bump version and create a new release with automated CI/CD
examples:
  - /release patch
  - /release minor
  - /release major
  - /release prerelease
---

# Release New Version

Create a new release for the vkm project following semantic versioning.

## Arguments
The user should specify the version bump type:
- `patch` - Bug fixes (0.0.147 → 0.0.148)
- `minor` - New features (0.0.147 → 0.1.0)
- `major` - Breaking changes (0.0.147 → 1.0.0)
- `prerelease` - Alpha/beta (0.0.147 → 0.0.148-0)

## Process

### 1. Pre-Release Checks
Before bumping version, ensure everything is clean:
- Run `/fix-ci` to fix all linting, formatting, and type errors
- Verify all tests pass with `cargo test --workspace`
- Ensure working directory is clean: `git status` should show no uncommitted changes

### 2. Version Bump
Use the provided script or manual process:

**Using the helper script (recommended):**
```bash
./scripts/release.sh [patch|minor|major|prerelease]
```

**Manual process:**
```bash
# 1. Bump package.json versions
pnpm version [patch|minor|major|prerelease]

# 2. Sync Cargo versions (install cargo-edit first time: cargo install cargo-edit)
cargo set-version --workspace $(node -p "require('./package.json').version")

# 3. Stage changes
git add package.json pnpm-lock.yaml npx-cli/package.json frontend/package.json Cargo.toml Cargo.lock crates/*/Cargo.toml

# 4. Commit (the release script handles this, but if manual:)
NEW_VERSION=$(node -p "require('./package.json').version")
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 5. Push to trigger release
git push && git push --tags
```

### 3. Monitor Release Workflow
After pushing the tag, the GitHub Actions workflow will:
1. ✅ Run all tests (fails fast if tests don't pass)
2. 🏗️ Build frontend with optimizations
3. 🦀 Build Rust binaries for 6 platforms:
   - Linux x64/ARM64 (musl)
   - macOS x64/ARM64 (universal)
   - Windows x64/ARM64
4. 📦 Package NPM tarball with binaries
5. 🎉 Create GitHub Release with changelog and binaries
6. 🚀 Publish to NPM (only for stable releases, not prereleases)

Monitor progress at: https://github.com/miermontoto/vkm/actions

### 4. If Workflow Fails
If the workflow fails due to linting/formatting:
1. Run `/fix-ci` to fix all issues
2. Commit the fixes
3. Delete and recreate the tag:
   ```bash
   git tag -d v[VERSION]
   git push origin :refs/tags/v[VERSION]
   git tag -a "v[VERSION]" -m "Release v[VERSION]"
   git push --tags
   ```

### 5. Verify Release
Once complete:
- Check GitHub Releases: https://github.com/miermontoto/vkm/releases
- Verify NPM package: https://www.npmjs.com/package/@miermontoto/vkm
- Test installation: `npx @miermontoto/vkm@latest --version`

## Important Notes
- **Prereleases** (containing `-`, `alpha`, `beta`, or `rc`) are NOT auto-published to NPM
- **Version numbers** must follow semver (MAJOR.MINOR.PATCH)
- **Tags** must be in format `vX.Y.Z` (e.g., `v1.2.3`)
- All tests must pass before binaries are built
- The exact binaries tested are what get released (reproducible builds)
- Never force push to main/master
- The release workflow has Sentry and PostHog removed as of v1.0.0

## Troubleshooting

### NPM Token Not Set
If NPM publish fails with authentication error:
- Go to GitHub repository Settings → Secrets → Actions
- Add `NODE_AUTH_TOKEN` secret with your NPM access token

### Build Artifacts Missing
If GitHub Release is created but binaries are missing:
- Check the build logs in GitHub Actions
- Verify all platform builds succeeded
- Check for out-of-disk-space errors in runners

### Release Already Exists
If trying to re-release the same version:
- Delete the GitHub Release first
- Delete the git tag locally and remotely
- Recreate the tag and push again
