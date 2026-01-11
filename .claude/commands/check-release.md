---
description: Check the status of the current or latest release workflow
examples:
  - /check-release
  - /check-release v1.0.0
---

# Check Release Status

Check the status of GitHub Actions release workflows for the vkm project.

## What to Check

### 1. Get Latest Release Workflow
```bash
gh run list --workflow=release.yml --limit 5
```

Look for:
- ✅ Status: `completed` with `success` - Release completed successfully
- ⏳ Status: `in_progress` or `queued` - Release is running
- ❌ Status: `completed` with `failure` - Release failed

### 2. View Detailed Status
For a specific workflow run (get ID from step 1):
```bash
gh run view [RUN_ID]
```

This shows:
- Which jobs completed successfully
- Which jobs failed and why
- Current status of in-progress jobs

### 3. View Failed Logs
If a workflow failed:
```bash
gh run view [RUN_ID] --log-failed
```

Common failure causes to look for:
- **Linting errors**: Look for ESLint, Prettier, or rustfmt issues → Run `/fix-ci`
- **Type errors**: TypeScript or type generation issues → Run `pnpm run generate-types`
- **Clippy warnings**: Rust code quality issues → Check clippy output and fix
- **Test failures**: Unit test failures → Run `cargo test --workspace` locally
- **Build failures**: Compilation errors → Check Rust/TypeScript compile errors

### 4. Check GitHub Releases
View all published releases:
```bash
gh release list
```

Or view details of a specific release:
```bash
gh release view v[VERSION]
```

### 5. Check NPM Package
Verify the package was published:
```bash
npm view @miermontoto/vkm versions --json | jq '.[-5:]'
```

Check latest version:
```bash
npm view @miermontoto/vkm version
```

## Workflow Stages

The release workflow has these stages:

1. **test** (runs first, ~12-15 minutes)
   - Lint frontend (ESLint)
   - Format check frontend (Prettier)
   - Type check frontend (TypeScript)
   - Build frontend
   - Run checks (cargo fmt, type generation, database prep, tests, clippy)

2. **build-frontend** (after tests pass)
   - Build optimized production frontend

3. **build-backend** (parallel builds for all platforms)
   - Build for Linux x64/ARM64
   - Build for macOS x64/ARM64
   - Build for Windows x64/ARM64

4. **package-npm** (after all builds complete)
   - Package NPM tarball with all binaries

5. **create-release** (after packaging)
   - Create GitHub Release with changelog
   - Upload all binary artifacts

6. **publish-npm** (after release created, only for stable versions)
   - Publish to NPM registry

## Status Summary

Provide a clear summary:
- **Current status**: In progress / Queued / Failed / Success
- **Stage**: Which stage is running or where it failed
- **Time**: How long it's been running
- **Next steps**: What the user should do (if action needed)

## If Workflow is Stuck

If a workflow shows "queued" for a long time:
- This is usually GitHub Actions runner capacity issue
- The tests have passed, just waiting for build runners
- No action needed - it will complete when runners are available
- Typical wait: a few minutes to an hour during peak times

## If You Need to Retry

If a release failed and needs to be retried after fixes:
1. Run `/fix-ci` to fix the issues
2. Commit the fixes
3. Delete and recreate the tag:
   ```bash
   git tag -d v[VERSION]
   git push origin :refs/tags/v[VERSION]
   git tag -a "v[VERSION]" -m "Release v[VERSION]"
   git push --tags
   ```

## Useful Links

Always provide these links in the response:
- Actions: https://github.com/miermontoto/vkm/actions
- Releases: https://github.com/miermontoto/vkm/releases
- NPM: https://www.npmjs.com/package/@miermontoto/vkm
