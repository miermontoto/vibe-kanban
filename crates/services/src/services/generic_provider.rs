//! Generic git provider for unknown or unsupported hosts.
//!
//! This module provides minimal support for any git repository,
//! focusing on basic git operations without provider-specific features.

use std::path::Path;

use async_trait::async_trait;
use db::models::merge::PullRequestInfo;

use super::{
    git::GitService,
    git_provider::{
        GitProviderError, GitProviderKind, GitProviderService, ProviderCapability, RepoInfo,
    },
    github::{CreatePrRequest, UnifiedPrComment},
};

/// Generic provider for unknown git hosts
#[derive(Clone, Debug)]
pub struct GenericProvider {
    git_service: GitService,
}

impl GenericProvider {
    pub fn new() -> Self {
        Self {
            git_service: GitService::new(),
        }
    }
}

impl Default for GenericProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GitProviderService for GenericProvider {
    async fn get_repo_info(&self, repo_path: &Path) -> Result<RepoInfo, GitProviderError> {
        // obtener la URL del remoto desde git
        let remotes = self
            .git_service
            .get_all_remotes(repo_path)
            .map_err(|e| GitProviderError::Repository(format!("Failed to get remotes: {}", e)))?;

        let remote_url = remotes
            .first()
            .and_then(|r| r.url.as_ref())
            .ok_or_else(|| GitProviderError::Repository("No remote URL found".to_string()))?;

        RepoInfo::from_remote_url(remote_url)
    }

    async fn check_auth(&self) -> Result<(), GitProviderError> {
        // proveedores genéricos usan credenciales git estándar
        Ok(())
    }

    async fn create_pr(
        &self,
        repo_info: &RepoInfo,
        _request: &CreatePrRequest,
    ) -> Result<PullRequestInfo, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(format!(
            "Pull request creation is not supported for {}. Please create the PR manually on the web interface.",
            repo_info.host
        )))
    }

    async fn update_pr_status(
        &self,
        _pr_url: &str,
    ) -> Result<PullRequestInfo, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "PR status updates are not supported for generic git providers".to_string(),
        ))
    }

    async fn list_prs_for_branch(
        &self,
        _repo_info: &RepoInfo,
        _branch_name: &str,
    ) -> Result<Vec<PullRequestInfo>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "PR listing is not supported for generic git providers".to_string(),
        ))
    }

    async fn get_pr_comments(
        &self,
        _repo_info: &RepoInfo,
        _pr_number: i64,
    ) -> Result<Vec<UnifiedPrComment>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "PR comments are not supported for generic git providers".to_string(),
        ))
    }

    fn capability(&self) -> ProviderCapability {
        ProviderCapability::Minimal
    }

    fn provider_kind(&self) -> GitProviderKind {
        GitProviderKind::Generic
    }
}
