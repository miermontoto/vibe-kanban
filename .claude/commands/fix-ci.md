---
description: Fix all linting, formatting, and type errors to pass CI/CD checks
examples:
  - /fix-ci
  - /fix-ci --commit
---

# Fix CI/CD Issues

Please fix all linting, formatting, type errors, and other CI/CD checks for the vkm project. Follow this systematic approach:

## 1. Frontend Fixes

### Linting
- Run `pnpm run lint` to check for ESLint errors
- Common fixes needed:
  - Rename files to match PascalCase naming convention (e.g., `tag.tsx` → `Tag.tsx`)
  - Fix ESLint directive comments that are misinterpreted (use clear descriptions)
  - Fix React hooks warnings (capture refs in variables before using in cleanup)
  - Replace `any` types with `unknown` or proper types
  - Use `satisfies` instead of `as any` for type assertions

### Formatting
- Run `pnpm run format` to auto-fix Prettier formatting issues

### Type Checking
- Run `pnpm run check` to verify TypeScript types
- Common fixes:
  - Use correct type names (e.g., `CreateTaskAndStartRequest` not `CreateAndStartTaskRequest`)
  - Add missing type exports in `shared/types.ts`
  - Use `satisfies CreateTask` or `satisfies UpdateTask` for form data

## 2. Rust Fixes

### Formatting
- Run `cargo fmt --all` to format all Rust code

### Type Generation
- Run `pnpm run generate-types` to regenerate TypeScript types from Rust
- If types are missing, check `crates/server/src/bin/generate_types.rs` and add missing `::decl()` calls
- Common missing types: `TaskType`, `TaskStatus`, enums

### Clippy Warnings
- Run `cargo clippy --all --all-targets -- -D warnings` to check for issues
- Common clippy fixes:
  - `too_many_arguments`: Add `#[allow(clippy::too_many_arguments)]` above function
  - `new_without_default`: Add `impl Default` with `fn default() -> Self { Self }`
  - `needless_borrow`: Remove unnecessary `&` operators
  - `io_other_error`: Use `std::io::Error::other(msg)` instead of `Error::new(ErrorKind::Other, msg)`
  - `default_constructed_unit_structs`: Use `Self` instead of `Self::default()` for unit structs
  - `collapsible_if`: Collapse nested if statements using `&&` and `let` chains

### Database Preparation
- Run `pnpm run prepare-db` for local SQLite
- Run `pnpm run remote:prepare-db` for remote Postgres

## 3. Testing
- Run `cargo test --workspace` to ensure all tests pass

## 4. i18n (Internationalization) Check
- Run `./scripts/check-i18n.sh` to verify translation keys are complete
- If missing translation keys are found:
  - Locate the translation files in `frontend/src/i18n/locales/`
  - Add missing keys to each language file (ja, ko, zh-Hans, zh-Hant, es)
  - Use English text as placeholder or add "[Translation needed: ...]" markers
  - Re-run the check to verify all keys exist
- Note: This check is non-blocking in CI (continues even if it fails)

## 5. Final Verification
After all fixes:
1. Run `pnpm run check` (frontend type check)
2. Run `pnpm run lint` (frontend lint)
3. Run `cargo fmt --all -- --check` (Rust formatting check)
4. Run `pnpm run generate-types:check` (type generation check)
5. Run `cargo clippy --all --all-targets -- -D warnings` (Rust lint)

## 5. Optional: Commit Changes
If the user requested `--commit` or explicitly asked to commit:
- Stage all fixed files with `git add .`
- Create a commit with message: `fix: resolve CI/CD linting, formatting, and type errors`
- DO NOT push automatically - let the user review first

## Important Notes
- Apply fixes incrementally and verify each step
- If clippy suggests changes, follow its suggestions or add `#[allow(...)]` attributes
- Always run type generation after modifying Rust structs/enums that are exported to TypeScript
- Check `.github/workflows/release.yml` to see exact CI commands if unsure
