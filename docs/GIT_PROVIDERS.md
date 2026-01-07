# Multi-Provider Git Support

Vibe Kanban now supports multiple git hosting providers with varying levels of integration.

## Supported Providers

### Tier 1: Full Support
Providers with comprehensive CLI/API integration for all features.

#### GitHub (`github.com`)
- ✅ Pull request creation and management
- ✅ PR comments (general and inline review)
- ✅ PR status updates
- ✅ GitHub CLI (`gh`) integration
- ✅ OAuth authentication support
- ✅ GitHub App integration (remote deployment)

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Or GitHub App configured (for remote deployments)

### Tier 2: Basic Support
Providers with basic URL-based PR creation (manual browser workflow).

#### GitLab (`gitlab.com` and self-hosted)
- ⚠️ Merge Request creation via URL redirect
- ❌ MR comments (requires `glab` CLI or API)
- ❌ MR status updates (requires `glab` CLI or API)

**Requirements:**
- Git authentication configured (HTTPS or SSH)

**Future enhancements:**
- GitLab CLI (`glab`) integration
- API-based MR management
- Self-hosted GitLab support improvements

#### Bitbucket (`bitbucket.org`)
- ⚠️ Pull request creation via URL redirect
- ❌ PR comments (requires MCP Bitbucket plugin)
- ❌ PR status updates (requires MCP Bitbucket plugin)

**Requirements:**
- Git authentication configured (HTTPS or SSH)

**Future enhancements:**
- MCP Bitbucket plugin integration (available in MCP ecosystem)
- Bitbucket Cloud API integration

### Tier 3: Minimal Support
Generic git providers with no provider-specific features.

#### Azure DevOps (`dev.azure.com`)
- ⚠️ Generic git operations only
- ❌ No PR/MR support

#### Generic Git Providers
- ⚠️ Generic git operations only
- ❌ No PR/MR support

**Requirements:**
- Git authentication configured (HTTPS or SSH)

---

## Architecture

### Provider Detection

The system automatically detects the git provider from the remote URL:

```rust
// Supported URL formats:
// GitHub:  git@github.com:owner/repo.git
//          https://github.com/owner/repo.git
// GitLab:  git@gitlab.com:owner/repo.git
//          https://gitlab.example.com/owner/repo.git
// Bitbucket: git@bitbucket.org:owner/repo.git
```

Detection happens in `crates/services/src/services/git_provider.rs:RepoInfo::from_remote_url()`.

### Provider Abstraction

All providers implement the `GitProviderService` trait:

```rust
#[async_trait]
pub trait GitProviderService: Send + Sync {
    async fn get_repo_info(&self, repo_path: &Path) -> Result<RepoInfo, GitProviderError>;
    async fn check_auth(&self) -> Result<(), GitProviderError>;
    async fn create_pr(&self, repo_info: &RepoInfo, request: &CreatePrRequest)
        -> Result<PullRequestInfo, GitProviderError>;
    async fn update_pr_status(&self, pr_url: &str)
        -> Result<PullRequestInfo, GitProviderError>;
    async fn list_prs_for_branch(&self, repo_info: &RepoInfo, branch_name: &str)
        -> Result<Vec<PullRequestInfo>, GitProviderError>;
    async fn get_pr_comments(&self, repo_info: &RepoInfo, pr_number: i64)
        -> Result<Vec<UnifiedPrComment>, GitProviderError>;

    fn capability(&self) -> ProviderCapability;
    fn provider_kind(&self) -> GitProviderKind;
}
```

### Provider Factory

The `GitProviderFactory` automatically creates the appropriate provider instance:

```rust
// From repository path
let provider = GitProviderFactory::from_repo_path(repo_path).await?;

// From remote URL
let provider = GitProviderFactory::from_remote_url(remote_url)?;

// From parsed RepoInfo
let provider = GitProviderFactory::from_repo_info(&repo_info)?;
```

---

## Usage

### For Users

The application automatically detects your git provider. No configuration needed!

1. **GitHub repositories**: Full PR functionality via GitHub CLI
2. **GitLab repositories**: MR creation opens in browser
3. **Bitbucket repositories**: PR creation opens in browser
4. **Other providers**: Basic git operations only

### For Developers

#### Adding a New Provider

1. **Create provider module** in `crates/services/src/services/`:
   ```rust
   // my_provider.rs
   use async_trait::async_trait;
   use super::git_provider::{GitProviderService, GitProviderKind, ...};

   pub struct MyProvider { ... }

   #[async_trait]
   impl GitProviderService for MyProvider { ... }
   ```

2. **Add to module exports** in `crates/services/src/services/mod.rs`:
   ```rust
   pub mod my_provider;
   ```

3. **Update provider detection** in `git_provider.rs:RepoInfo::parse_*_url()`:
   ```rust
   fn parse_my_provider_url(url: &str) -> Result<Self, GitProviderError> {
       // URL parsing logic
   }
   ```

4. **Update factory** in `git_provider.rs:GitProviderFactory`:
   ```rust
   GitProviderKind::MyProvider => Ok(Box::new(MyProvider::new())),
   ```

5. **Add TypeScript types** in `crates/server/src/bin/generate_types.rs` if exposing new types

6. **Run tests**:
   ```bash
   cargo test --workspace
   pnpm run check
   ```

#### Provider Capabilities

Declare your provider's capability level:

```rust
fn capability(&self) -> ProviderCapability {
    ProviderCapability::Full    // GitHub-level integration
    // or
    ProviderCapability::Basic   // URL-based PR creation
    // or
    ProviderCapability::Minimal // Git operations only
}
```

---

## Error Handling

Providers use `GitProviderError` for consistent error reporting:

```rust
pub enum GitProviderError {
    InvalidUrl(String),
    UnsupportedProvider(String),
    OperationNotSupported(String),
    Repository(String),
    PullRequest(String),
    AuthFailed(String),
    InsufficientPermissions(String),
    RepoNotFoundOrNoAccess(String),
    CliNotInstalled(String),
}
```

Errors include `should_retry()` logic for automatic retry with exponential backoff.

---

## TypeScript Types

Frontend types are auto-generated from Rust definitions:

```typescript
export type GitProviderKind =
    | "git_hub"
    | "git_lab"
    | "bitbucket"
    | "azure_dev_ops"
    | "generic";

export type RepoInfo = {
    kind: GitProviderKind;
    owner: string;
    repo_name: string;
    base_url: string;
    host: string;
};
```

Regenerate after Rust changes:
```bash
pnpm run generate-types
```

---

## Testing

### Unit Tests

Run provider URL parsing tests:
```bash
cargo test --package services git_provider::tests
```

### Integration Tests

Test with real repositories:
```bash
# GitHub
git clone https://github.com/owner/repo
# Open in Vibe Kanban and test PR creation

# GitLab
git clone https://gitlab.com/owner/repo
# Test MR creation URL redirect

# Bitbucket
git clone https://bitbucket.org/owner/repo
# Test PR creation URL redirect
```

---

## Future Enhancements

### Short-term
- [ ] GitLab CLI (`glab`) integration for Tier 1 support
- [ ] MCP Bitbucket plugin integration
- [ ] Azure DevOps API support

### Long-term
- [ ] Gitea support
- [ ] Forgejo support
- [ ] Sourcehut support
- [ ] Custom provider plugins via MCP

---

## Migration from GitHub-only

The refactor maintains backward compatibility:

- Existing `GitHubService` now implements `GitProviderService`
- `GitHubRepoInfo` remains available for compatibility
- All existing GitHub functionality unchanged
- New providers are additive, not breaking changes

### Converting Code

Old code:
```rust
let github_service = GitHubService::new()?;
let repo_info = github_service.get_repo_info(repo_path).await?;
```

New code (provider-agnostic):
```rust
let provider = GitProviderFactory::from_repo_path(repo_path).await?;
let repo_info = provider.get_repo_info(repo_path).await?;
```

Both approaches work! The factory is recommended for multi-provider support.

---

## Troubleshooting

### "GitHub CLI not installed" error
- Install GitHub CLI: https://cli.github.com/
- Authenticate: `gh auth login`

### "Operation not supported" for GitLab/Bitbucket
- Expected for Tier 2 providers
- Use the provided URL to create PR/MR in browser
- Watch for future CLI/API integrations

### Provider not detected
- Check remote URL format: `git remote -v`
- Ensure URL matches supported patterns
- Falls back to Generic provider if unknown

### Authentication issues
- GitHub: `gh auth status`
- Others: Verify SSH keys or HTTPS credentials
- Check git config: `git config --list | grep credential`
