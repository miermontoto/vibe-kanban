//! GitLab provider implementation with basic URL-based support.
//!
//! This module provides basic support for GitLab repositories (gitlab.com and self-hosted).
//! Advanced features can be added later using GitLab CLI (glab) or API integration.

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

/// Basic GitLab service with URL-based operations
#[derive(Clone, Debug)]
pub struct GitLabService {
    git_service: GitService,
}

impl GitLabService {
    pub fn new() -> Self {
        Self {
            git_service: GitService::new(),
        }
    }

    /// construye la URL de creación de merge request para gitlab
    fn build_mr_url(repo_info: &RepoInfo, request: &CreatePrRequest) -> String {
        // formato: https://gitlab.com/owner/repo/-/merge_requests/new?merge_request[source_branch]=head&merge_request[target_branch]=base&merge_request[title]=...
        let mut url = format!(
            "{}/-/merge_requests/new?merge_request[source_branch]={}&merge_request[target_branch]={}",
            repo_info.base_url,
            urlencoding::encode(&request.head_branch),
            urlencoding::encode(&request.base_branch)
        );

        // agregar título
        url.push_str(&format!(
            "&merge_request[title]={}",
            urlencoding::encode(&request.title)
        ));

        // agregar descripción si existe
        if let Some(ref body) = request.body {
            url.push_str(&format!(
                "&merge_request[description]={}",
                urlencoding::encode(body)
            ));
        }

        url
    }
}

impl Default for GitLabService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GitProviderService for GitLabService {
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
        // gitlab usa git credentials o glab CLI (no implementado aún)
        // retornamos Ok si git está disponible
        Ok(())
    }

    async fn create_pr(
        &self,
        repo_info: &RepoInfo,
        request: &CreatePrRequest,
    ) -> Result<PullRequestInfo, GitProviderError> {
        // para gitlab sin CLI/API, devolvemos una URL que el usuario puede abrir
        let mr_url = Self::build_mr_url(repo_info, request);

        // nota: gitlab llama "merge requests" a lo que github llama "pull requests"
        Err(GitProviderError::OperationNotSupported(format!(
            "GitLab Merge Request creation requires manual action. Please open this URL to create the MR: {}",
            mr_url
        )))
    }

    async fn update_pr_status(
        &self,
        _pr_url: &str,
    ) -> Result<PullRequestInfo, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "GitLab MR status updates require glab CLI or API integration".to_string(),
        ))
    }

    async fn list_prs_for_branch(
        &self,
        _repo_info: &RepoInfo,
        _branch_name: &str,
    ) -> Result<Vec<PullRequestInfo>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "GitLab MR listing requires glab CLI or API integration".to_string(),
        ))
    }

    async fn get_pr_comments(
        &self,
        _repo_info: &RepoInfo,
        _pr_number: i64,
    ) -> Result<Vec<UnifiedPrComment>, GitProviderError> {
        Err(GitProviderError::OperationNotSupported(
            "GitLab MR comments require glab CLI or API integration".to_string(),
        ))
    }

    fn capability(&self) -> ProviderCapability {
        ProviderCapability::Basic
    }

    fn provider_kind(&self) -> GitProviderKind {
        GitProviderKind::GitLab
    }
}
