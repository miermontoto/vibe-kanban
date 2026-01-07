//! Git provider abstraction layer for multi-provider support.
//!
//! This module provides a unified interface for interacting with different git providers
//! (GitHub, GitLab, Bitbucket, etc.) with varying levels of support:
//!
//! - **Tier 1 (Full support)**: PR creation, comments, status updates, CLI integration
//! - **Tier 2 (Basic support)**: PR creation via URL redirect, basic git operations
//! - **Tier 3 (Minimal support)**: Generic git operations only, no provider-specific features

use std::path::Path;

use async_trait::async_trait;
use db::models::merge::PullRequestInfo;
use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

use super::github::{CreatePrRequest, GitHubRepoInfo, UnifiedPrComment};

/// Identifies the git hosting provider from remote URLs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename_all = "snake_case")]
pub enum GitProviderKind {
    /// GitHub (github.com)
    GitHub,
    /// GitLab (gitlab.com or self-hosted)
    GitLab,
    /// Bitbucket (bitbucket.org)
    Bitbucket,
    /// Azure DevOps (dev.azure.com / azure.com)
    AzureDevOps,
    /// Generic git provider (no specific integration)
    Generic,
}

/// Repository information extracted from remote URLs
#[derive(Debug, Clone, Serialize, TS)]
pub struct RepoInfo {
    /// Provider kind
    pub kind: GitProviderKind,
    /// Repository owner/organization/workspace
    pub owner: String,
    /// Repository name
    pub repo_name: String,
    /// Base URL for web interface (e.g., https://github.com/owner/repo)
    pub base_url: String,
    /// Host (e.g., github.com, gitlab.com)
    pub host: String,
}

impl RepoInfo {
    /// Create a RepoInfo from a remote URL
    pub fn from_remote_url(remote_url: &str) -> Result<Self, GitProviderError> {
        // Try to detect provider and parse URL
        if remote_url.contains("github.com") {
            Self::parse_github_url(remote_url)
        } else if remote_url.contains("gitlab.com") || remote_url.contains("gitlab") {
            Self::parse_gitlab_url(remote_url)
        } else if remote_url.contains("bitbucket.org") {
            Self::parse_bitbucket_url(remote_url)
        } else if remote_url.contains("dev.azure.com") || remote_url.contains("visualstudio.com") {
            Self::parse_azure_devops_url(remote_url)
        } else {
            Self::parse_generic_url(remote_url)
        }
    }

    fn parse_github_url(url: &str) -> Result<Self, GitProviderError> {
        // soporta SSH (git@github.com:owner/repo.git), HTTPS (https://github.com/owner/repo.git)
        let re = Regex::new(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)")
            .map_err(|e| {
                GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}"))
            })?;

        let caps = re.captures(url).ok_or_else(|| {
            GitProviderError::InvalidUrl(format!("Invalid GitHub URL format: {url}"))
        })?;

        let owner = caps["owner"].to_string();
        let repo = caps["repo"].to_string();

        Ok(Self {
            kind: GitProviderKind::GitHub,
            owner: owner.clone(),
            repo_name: repo.clone(),
            base_url: format!("https://github.com/{}/{}", owner, repo),
            host: "github.com".to_string(),
        })
    }

    fn parse_gitlab_url(url: &str) -> Result<Self, GitProviderError> {
        // soporta gitlab.com y gitlab autoalojado
        // patrón: git@gitlab.com:owner/repo.git o https://gitlab.com/owner/repo.git
        let re = Regex::new(
            r"(?P<host>[^:/]+)[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)",
        )
        .map_err(|e| GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}")))?;

        let caps = re
            .captures(url)
            .ok_or_else(|| GitProviderError::InvalidUrl(format!("Invalid GitLab URL format: {url}")))?;

        let host = caps["host"].to_string();
        let owner = caps["owner"].to_string();
        let repo = caps["repo"].to_string();

        // determinar si es gitlab.com u otro
        let base_url = if host.contains("gitlab.com") {
            format!("https://gitlab.com/{}/{}", owner, repo)
        } else {
            format!("https://{}/{}/{}", host, owner, repo)
        };

        Ok(Self {
            kind: GitProviderKind::GitLab,
            owner,
            repo_name: repo,
            base_url,
            host,
        })
    }

    fn parse_bitbucket_url(url: &str) -> Result<Self, GitProviderError> {
        // soporta SSH y HTTPS para bitbucket.org
        // patrón: git@bitbucket.org:owner/repo.git o https://bitbucket.org/owner/repo.git
        let re =
            Regex::new(r"bitbucket\.org[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)")
                .map_err(|e| {
                    GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}"))
                })?;

        let caps = re.captures(url).ok_or_else(|| {
            GitProviderError::InvalidUrl(format!("Invalid Bitbucket URL format: {url}"))
        })?;

        let owner = caps["owner"].to_string();
        let repo = caps["repo"].to_string();

        Ok(Self {
            kind: GitProviderKind::Bitbucket,
            owner: owner.clone(),
            repo_name: repo.clone(),
            base_url: format!("https://bitbucket.org/{}/{}", owner, repo),
            host: "bitbucket.org".to_string(),
        })
    }

    fn parse_azure_devops_url(url: &str) -> Result<Self, GitProviderError> {
        // soporta formato nuevo: https://dev.azure.com/organization/project/_git/repo
        // y formato viejo: https://organization.visualstudio.com/project/_git/repo
        let re_new = Regex::new(
            r"dev\.azure\.com/(?P<owner>[^/]+)/(?P<project>[^/]+)/_git/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)",
        )
        .map_err(|e| GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}")))?;

        let re_old = Regex::new(
            r"(?P<owner>[^.]+)\.visualstudio\.com/(?P<project>[^/]+)/_git/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)",
        )
        .map_err(|e| GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}")))?;

        if let Some(caps) = re_new.captures(url) {
            let owner = caps["owner"].to_string();
            let project = caps["project"].to_string();
            let repo = caps["repo"].to_string();

            Ok(Self {
                kind: GitProviderKind::AzureDevOps,
                owner: owner.clone(),
                repo_name: repo.clone(),
                base_url: format!("https://dev.azure.com/{}/{}/_git/{}", owner, project, repo),
                host: "dev.azure.com".to_string(),
            })
        } else if let Some(caps) = re_old.captures(url) {
            let owner = caps["owner"].to_string();
            let project = caps["project"].to_string();
            let repo = caps["repo"].to_string();

            Ok(Self {
                kind: GitProviderKind::AzureDevOps,
                owner: owner.clone(),
                repo_name: repo.clone(),
                base_url: format!(
                    "https://{}.visualstudio.com/{}/_git/{}",
                    owner, project, repo
                ),
                host: format!("{}.visualstudio.com", owner),
            })
        } else {
            Err(GitProviderError::InvalidUrl(format!(
                "Invalid Azure DevOps URL format: {url}"
            )))
        }
    }

    fn parse_generic_url(url: &str) -> Result<Self, GitProviderError> {
        // intento genérico: extraer host, owner y repo de cualquier URL tipo git
        // patrón básico: [usuario@]host:owner/repo[.git]
        let re = Regex::new(
            r"(?:(?:https?://)|(?:[^@]+@))?(?P<host>[^:/]+)[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?(?:/|$)",
        )
        .map_err(|e| GitProviderError::InvalidUrl(format!("Failed to compile regex: {e}")))?;

        let caps = re
            .captures(url)
            .ok_or_else(|| GitProviderError::InvalidUrl(format!("Invalid git URL format: {url}")))?;

        let host = caps["host"].to_string();
        let owner = caps["owner"].to_string();
        let repo = caps["repo"].to_string();

        Ok(Self {
            kind: GitProviderKind::Generic,
            owner: owner.clone(),
            repo_name: repo.clone(),
            base_url: format!("https://{}/{}/{}", host, owner, repo),
            host,
        })
    }

    /// Convert to legacy GitHubRepoInfo for backward compatibility
    pub fn to_github_repo_info(&self) -> GitHubRepoInfo {
        GitHubRepoInfo {
            owner: self.owner.clone(),
            repo_name: self.repo_name.clone(),
        }
    }
}

/// Errors that can occur when working with git providers
#[derive(Debug, Error)]
pub enum GitProviderError {
    #[error("Invalid URL format: {0}")]
    InvalidUrl(String),
    #[error("Provider not supported: {0}")]
    UnsupportedProvider(String),
    #[error("Operation not supported by this provider: {0}")]
    OperationNotSupported(String),
    #[error("Repository error: {0}")]
    Repository(String),
    #[error("Pull request error: {0}")]
    PullRequest(String),
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    #[error("Insufficient permissions: {0}")]
    InsufficientPermissions(String),
    #[error("Repository not found or no access: {0}")]
    RepoNotFoundOrNoAccess(String),
    #[error("CLI tool not installed: {0}")]
    CliNotInstalled(String),
}

impl GitProviderError {
    /// determina si el error es recuperable y vale la pena reintentarlo
    pub fn should_retry(&self) -> bool {
        !matches!(
            self,
            GitProviderError::AuthFailed(_)
                | GitProviderError::InsufficientPermissions(_)
                | GitProviderError::RepoNotFoundOrNoAccess(_)
                | GitProviderError::CliNotInstalled(_)
                | GitProviderError::UnsupportedProvider(_)
                | GitProviderError::OperationNotSupported(_)
        )
    }
}

/// Nivel de soporte que ofrece un proveedor
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderCapability {
    /// soporte completo: PR, comentarios, CLI
    Full,
    /// soporte básico: creación de PR via URL, operaciones git
    Basic,
    /// soporte mínimo: solo operaciones git genéricas
    Minimal,
}

/// Factory para crear instancias de proveedores según el tipo de repositorio
pub struct GitProviderFactory;

impl GitProviderFactory {
    /// detecta y crea el proveedor adecuado desde un path de repositorio
    pub async fn from_repo_path(
        repo_path: &Path,
    ) -> Result<Box<dyn GitProviderService>, GitProviderError> {
        use super::{bitbucket::BitbucketService, generic_provider::GenericProvider, git::GitService, github::GitHubService, gitlab::GitLabService};

        // obtener la URL del remoto
        let git_service = GitService::new();
        let remotes = git_service
            .get_all_remotes(repo_path)
            .map_err(|e| GitProviderError::Repository(format!("Failed to get remotes: {}", e)))?;

        let remote_url = remotes
            .first()
            .and_then(|r| r.url.as_ref())
            .ok_or_else(|| GitProviderError::Repository("No remote URL found".to_string()))?;

        Self::from_remote_url(remote_url)
    }

    /// crea el proveedor adecuado desde una URL remota
    pub fn from_remote_url(
        remote_url: &str,
    ) -> Result<Box<dyn GitProviderService>, GitProviderError> {
        use super::{bitbucket::BitbucketService, generic_provider::GenericProvider, github::GitHubService, gitlab::GitLabService};

        // detectar el tipo de proveedor
        let repo_info = RepoInfo::from_remote_url(remote_url)?;

        match repo_info.kind {
            GitProviderKind::GitHub => Ok(Box::new(
                GitHubService::new()
                    .map_err(|e| GitProviderError::Repository(format!("GitHub service: {}", e)))?,
            )),
            GitProviderKind::GitLab => Ok(Box::new(GitLabService::new())),
            GitProviderKind::Bitbucket => Ok(Box::new(BitbucketService::new())),
            GitProviderKind::AzureDevOps | GitProviderKind::Generic => {
                Ok(Box::new(GenericProvider::new()))
            }
        }
    }

    /// crea el proveedor adecuado desde un RepoInfo ya parseado
    pub fn from_repo_info(
        repo_info: &RepoInfo,
    ) -> Result<Box<dyn GitProviderService>, GitProviderError> {
        use super::{bitbucket::BitbucketService, generic_provider::GenericProvider, github::GitHubService, gitlab::GitLabService};

        match repo_info.kind {
            GitProviderKind::GitHub => Ok(Box::new(
                GitHubService::new()
                    .map_err(|e| GitProviderError::Repository(format!("GitHub service: {}", e)))?,
            )),
            GitProviderKind::GitLab => Ok(Box::new(GitLabService::new())),
            GitProviderKind::Bitbucket => Ok(Box::new(BitbucketService::new())),
            GitProviderKind::AzureDevOps | GitProviderKind::Generic => {
                Ok(Box::new(GenericProvider::new()))
            }
        }
    }
}

/// Trait para servicios de proveedores git
#[async_trait]
pub trait GitProviderService: Send + Sync {
    /// obtener información del repositorio desde un path local
    async fn get_repo_info(&self, repo_path: &Path) -> Result<RepoInfo, GitProviderError>;

    /// verificar autenticación
    async fn check_auth(&self) -> Result<(), GitProviderError>;

    /// crear pull request
    async fn create_pr(
        &self,
        repo_info: &RepoInfo,
        request: &CreatePrRequest,
    ) -> Result<PullRequestInfo, GitProviderError>;

    /// actualizar estado de PR
    async fn update_pr_status(
        &self,
        pr_url: &str,
    ) -> Result<PullRequestInfo, GitProviderError>;

    /// listar PRs para una rama
    async fn list_prs_for_branch(
        &self,
        repo_info: &RepoInfo,
        branch_name: &str,
    ) -> Result<Vec<PullRequestInfo>, GitProviderError>;

    /// obtener comentarios de PR
    async fn get_pr_comments(
        &self,
        repo_info: &RepoInfo,
        pr_number: i64,
    ) -> Result<Vec<UnifiedPrComment>, GitProviderError>;

    /// obtener nivel de soporte del proveedor
    fn capability(&self) -> ProviderCapability;

    /// obtener tipo de proveedor
    fn provider_kind(&self) -> GitProviderKind;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_ssh_url() {
        let url = "git@github.com:owner/repo.git";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::GitHub);
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo_name, "repo");
        assert_eq!(info.base_url, "https://github.com/owner/repo");
    }

    #[test]
    fn test_github_https_url() {
        let url = "https://github.com/owner/repo.git";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::GitHub);
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo_name, "repo");
    }

    #[test]
    fn test_gitlab_ssh_url() {
        let url = "git@gitlab.com:owner/repo.git";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::GitLab);
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo_name, "repo");
        assert_eq!(info.base_url, "https://gitlab.com/owner/repo");
    }

    #[test]
    fn test_bitbucket_ssh_url() {
        let url = "git@bitbucket.org:owner/repo.git";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::Bitbucket);
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo_name, "repo");
        assert_eq!(info.base_url, "https://bitbucket.org/owner/repo");
    }

    #[test]
    fn test_azure_devops_new_format() {
        let url = "https://dev.azure.com/organization/project/_git/repo";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::AzureDevOps);
        assert_eq!(info.owner, "organization");
        assert_eq!(info.repo_name, "repo");
    }

    #[test]
    fn test_generic_url() {
        let url = "https://custom-git.example.com/owner/repo.git";
        let info = RepoInfo::from_remote_url(url).unwrap();
        assert_eq!(info.kind, GitProviderKind::Generic);
        assert_eq!(info.owner, "owner");
        assert_eq!(info.repo_name, "repo");
    }
}
