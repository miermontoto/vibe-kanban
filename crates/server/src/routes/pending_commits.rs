use std::path::PathBuf;

use axum::{
    Json, Router,
    extract::{Path, State},
    response::Json as ResponseJson,
    routing::{get, post},
};
use db::models::{merge::Merge, pending_commit::PendingCommit};
use deployment::Deployment;
use serde::Deserialize;
use services::services::{config::GitAutoPushMode, git::GitCli};
use ts_rs::TS;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

/// request para ejecutar un pending commit con título personalizado
#[derive(Debug, Clone, Deserialize, TS)]
pub struct CommitPendingRequest {
    pub title: String,
}

/// obtener todos los pending commits
pub async fn get_pending_commits(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<PendingCommit>>>, ApiError> {
    let pending_commits = PendingCommit::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(pending_commits)))
}

/// obtener el conteo de pending commits
pub async fn get_pending_commits_count(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<i64>>, ApiError> {
    let count = PendingCommit::count(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(count)))
}

/// ejecutar un pending commit con el título proporcionado por el usuario
pub async fn commit_pending(
    State(deployment): State<DeploymentImpl>,
    Path(pending_commit_id): Path<Uuid>,
    Json(payload): Json<CommitPendingRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    // validar el título del commit
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::BadRequest(
            "Commit title cannot be empty".to_string(),
        ));
    }
    if title.len() > 500 {
        return Err(ApiError::BadRequest(
            "Commit title too long (max 500 characters)".to_string(),
        ));
    }

    // obtener el pending commit
    let pending_commit = PendingCommit::find_by_id(&deployment.db().pool, pending_commit_id)
        .await?
        .ok_or(ApiError::BadRequest("Pending commit not found".to_string()))?;

    // obtener el workspace para acceder al container_ref
    let workspace = db::models::workspace::Workspace::find_by_id(
        &deployment.db().pool,
        pending_commit.workspace_id,
    )
    .await?
    .ok_or(ApiError::BadRequest("Workspace not found".to_string()))?;

    let container_ref = workspace
        .container_ref
        .as_ref()
        .ok_or(ApiError::BadRequest(
            "Workspace has no container reference".to_string(),
        ))?;

    let workspace_root = PathBuf::from(container_ref);
    let worktree_path = workspace_root.join(&pending_commit.repo_path);

    // ejecutar el commit con el título del usuario
    let git = GitCli::new();

    // intentar agregar cambios - si falla, limpiar el pending commit
    if let Err(e) = git.add_all(&worktree_path) {
        // limpiar el pending commit de la base de datos antes de retornar el error
        let _ = PendingCommit::delete(&deployment.db().pool, pending_commit_id).await;
        return Err(ApiError::BadRequest(format!(
            "git add failed (workspace may have been deleted): {e}"
        )));
    }

    // intentar hacer commit - si falla, limpiar el pending commit
    if let Err(e) = git.commit(&worktree_path, title) {
        // limpiar el pending commit de la base de datos antes de retornar el error
        let _ = PendingCommit::delete(&deployment.db().pool, pending_commit_id).await;
        return Err(ApiError::BadRequest(format!(
            "git commit failed (workspace may have been deleted): {e}"
        )));
    }

    // eliminar el pending commit de la base de datos solo si el commit fue exitoso
    PendingCommit::delete(&deployment.db().pool, pending_commit_id).await?;

    tracing::info!(
        "Committed pending commit {} with title: {}",
        pending_commit_id,
        title
    );

    // determinar si debemos hacer auto-push después del commit
    let should_auto_push = should_auto_push_after_commit(
        &deployment,
        workspace.task_id,
        workspace.id,
        pending_commit.repo_id,
        &worktree_path,
    )
    .await;

    if let Ok(true) = should_auto_push {
        // obtener el nombre de la rama actual para hacer push
        if let Ok(branch_name) = deployment.git().get_current_branch(&worktree_path) {
            tracing::info!(
                "Auto-pushing branch {} for workspace {} after manual commit",
                branch_name,
                workspace.id
            );
            if let Err(e) = deployment
                .git()
                .push_to_github(&worktree_path, &branch_name, false)
            {
                tracing::warn!("Auto-push failed after manual commit: {}", e);
                // no retornamos error - el commit fue exitoso, solo el push falló
            } else {
                tracing::info!("Auto-push successful after manual commit");
            }
        }
    }

    Ok(ResponseJson(ApiResponse::success(())))
}

/// descartar un pending commit sin ejecutar
pub async fn discard_pending(
    State(deployment): State<DeploymentImpl>,
    Path(pending_commit_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows_affected = PendingCommit::delete(&deployment.db().pool, pending_commit_id).await?;
    if rows_affected == 0 {
        Err(ApiError::BadRequest("Pending commit not found".to_string()))
    } else {
        tracing::info!("Discarded pending commit {}", pending_commit_id);
        Ok(ResponseJson(ApiResponse::success(())))
    }
}

/// descartar todos los pending commits
pub async fn discard_all_pending(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<u64>>, ApiError> {
    let total_deleted = PendingCommit::delete_all(&deployment.db().pool).await?;

    tracing::info!("Discarded {} pending commits", total_deleted);
    Ok(ResponseJson(ApiResponse::success(total_deleted)))
}

pub fn router() -> Router<DeploymentImpl> {
    let inner = Router::new()
        .route("/", get(get_pending_commits).delete(discard_all_pending))
        .route("/count", get(get_pending_commits_count))
        .route(
            "/{pending_commit_id}",
            post(commit_pending).delete(discard_pending),
        );

    Router::new().nest("/pending-commits", inner)
}

/// determina si se debe hacer auto-push después de un commit
/// retorna true si se debe hacer push, false si no
async fn should_auto_push_after_commit(
    deployment: &DeploymentImpl,
    task_id: Uuid,
    workspace_id: Uuid,
    repo_id: Uuid,
    worktree_path: &std::path::Path,
) -> Result<bool, ApiError> {
    // obtener la tarea para acceder al project_id
    let task = db::models::task::Task::find_by_id(&deployment.db().pool, task_id)
        .await?
        .ok_or(ApiError::BadRequest("Task not found".to_string()))?;

    // obtener el proyecto para verificar overrides
    let project = db::models::project::Project::find_by_id(&deployment.db().pool, task.project_id)
        .await?
        .ok_or(ApiError::BadRequest("Project not found".to_string()))?;

    // obtener la configuración global
    let config = deployment.config();

    // determinar el modo efectivo (project override > global config)
    let auto_push_mode_str = if let Some(mode) = &project.git_auto_push_mode {
        mode.as_str()
    } else {
        match config.read().await.git_auto_push_mode {
            GitAutoPushMode::Never => "Never",
            GitAutoPushMode::Always => "Always",
            GitAutoPushMode::IfPrExists => "IfPrExists",
        }
    };

    match auto_push_mode_str {
        "Never" => Ok(false),
        "Always" => Ok(true),
        "IfPrExists" => {
            // verificar si existe un PR abierto para esta rama
            let branch_name = deployment.git()
                .get_current_branch(worktree_path)
                .map_err(|e| ApiError::BadRequest(format!("Failed to get current branch: {e}")))?;

            let has_pr =
                Merge::has_open_pr_for_branch(&deployment.db().pool, workspace_id, repo_id, &branch_name)
                    .await?;

            Ok(has_pr)
        }
        _ => {
            tracing::warn!(
                "Unknown auto_push_mode value: {}, defaulting to Never",
                auto_push_mode_str
            );
            Ok(false)
        }
    }
}
