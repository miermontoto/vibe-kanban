//! Bitbucket provider implementation with basic URL-based support.
//!
//! This module provides basic support for Bitbucket repositories.
//! Since Bitbucket has an MCP integration available, advanced features
//! can be added later using that integration.

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

/// Basic Bitbucket service with URL-based operations
#[derive(Clone, Debug)]
pub struct BitbucketService {
    git_service: GitService,
}

impl BitbucketService {
    pub fn new() -> Self {
        Self {
            git_service: GitService::new(),
        }
    }

    /// construye la URL de creación de PR para bitbucket
    fn build_pr_url(repo_info: &RepoInfo, request: &CreatePrRequest) -> String {
        // formato: https://bitbucket.org/owner/repo/pull-requests/new?source=head_branch&dest=base_branch&title=...
        format!(
            "{}/pull-requests/new?source={}&dest={}&title={}",
            repo_info.base_url,
            urlencoding::encode(&request.head_branch),
            urlencoding::encode(&request.base_branch),
            urlencoding::encode(&request.title)
        )
    }
}

impl Default for BitbucketService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GitProviderService for BitbucketService {
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
        // bitbucket usa git credentials, no hay CLI específico a validar
        // retornamos Ok si git está disponible
        Ok(())
    }

    async fn create_pr(
        &self,
        repo_info: &RepoInfo,
        request: &CreatePrRequest,
    ) -> Result<PullRequestInfo, GitProviderError> {
        // para bitbucket sin CLI, devolvemos una URL que el usuario puede abrir
        let pr_url = Self::build_pr_url(repo_info, request);

        // nota: no podemos obtener un número de PR sin API/CLI, usamos 0 como placeholder
        Err(GitProviderError::OperationNotSupported(format!(
            "Bitbucket PR creation requires manual action. Please open this URL to create the PR: {}",
            pr_url
        )))
    }

    async fn update_pr_status(
        &self,
        _pr_url: &str,
    ) -> Result<PullRequestInfo, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "Bitbucket PR status updates require API integration (use MCP Bitbucket plugin)"
                .to_string(),
        ))
    }

    async fn list_prs_for_branch(
        &self,
        _repo_info: &RepoInfo,
        _branch_name: &str,
    ) -> Result<Vec<PullRequestInfo>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "Bitbucket PR listing requires API integration (use MCP Bitbucket plugin)"
                .to_string(),
        ))
    }

    async fn get_pr_comments(
        &self,
        _repo_info: &RepoInfo,
        _pr_number: i64,
    ) -> Result<Vec<UnifiedPrComment>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "Bitbucket PR comments require API integration (use MCP Bitbucket plugin)"
                .to_string(),
        ))
    }

    fn capability(&self) -> ProviderCapability {
        ProviderCapability::Basic
    }

    fn provider_kind(&self) -> GitProviderKind {
        GitProviderKind::Bitbucket
    }
}
