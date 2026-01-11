# Archived Workflows

These workflows were archived during the vkm rebrand and simplification of the release process.

## Replaced By

The complex multi-stage release system has been replaced by a single, streamlined `release.yml` workflow.

### Old System (Archived)
- `pre-release.yml` - Created GitHub pre-releases with binaries
- `publish.yml` - Published to NPM when converting pre-release to release
- `remote-deploy-dev.yml` - Remote deployment workflows
- `remote-deploy-prod.yml` - Remote deployment workflows

**Note:** `claude.yml` and `claude-code-review.yml` were restored as they provide ongoing developer productivity value through automated PR reviews.

### New System (Active)
- `release.yml` - Single workflow that handles everything:
  1. Tests (fail fast if tests don't pass)
  2. Build frontend
  3. Build backend binaries (6 platforms in parallel)
  4. Package NPM tarball
  5. Create GitHub Release
  6. Publish to NPM (for non-prerelease versions)

## Release Process

See the main repository CLAUDE.md for the new simplified release process.

### Quick Start
```bash
# Bump version and release
./scripts/release.sh patch  # or minor, major, prerelease

# Or manually
pnpm version patch
git push --tags
```

## Archive Date
January 11, 2026
