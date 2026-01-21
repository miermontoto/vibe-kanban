use axum::{
    Json, Router,
    extract::{Path, State},
    response::Json as ResponseJson,
    routing::{delete, post},
};
use chrono::{DateTime, Utc};
use db::models::task::{Task, TaskStatus};
use deployment::Deployment;
use remote::routes::tasks::SharedTaskResponse as RemoteSharedTaskResponse;
use serde::{Deserialize, Serialize};
use services::services::share::{ShareError, SharedTaskDetails};
use ts_rs::TS;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

// ----------------------------------------------------------
// Types for TypeScript generation (mirror remote crate types)
// These are only used for ts-rs export, not at runtime
// ----------------------------------------------------------

/// SharedTask type for Electric SQL sync with frontend.
/// This mirrors the remote crate's SharedTask DB model for TypeScript generation.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SharedTask {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub project_id: Uuid,
    pub creator_user_id: Option<Uuid>,
    pub assignee_user_id: Option<Uuid>,
    pub deleted_by_user_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub deleted_at: Option<DateTime<Utc>>,
    pub shared_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// UserData type for shared task assignees.
/// This mirrors the remote crate's UserData for TypeScript generation.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UserData {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
}

/// Query type for fetching task assignees by project.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export)]
pub struct AssigneesQuery {
    pub project_id: Uuid,
}

/// Response type for shared task operations.
/// This mirrors the remote crate's SharedTaskResponse for TypeScript generation.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SharedTaskResponse {
    pub task: SharedTask,
    pub user: Option<UserData>,
}

// ----------------------------------------------------------
// Request/Response types used at runtime
// ----------------------------------------------------------

#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export)]
pub struct AssignSharedTaskRequest {
    pub new_assignee_user_id: Option<String>,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route(
            "/shared-tasks/{shared_task_id}/assign",
            post(assign_shared_task),
        )
        .route("/shared-tasks/{shared_task_id}", delete(delete_shared_task))
        .route(
            "/shared-tasks/link-to-local",
            post(link_shared_task_to_local),
        )
}

pub async fn assign_shared_task(
    Path(shared_task_id): Path<Uuid>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<AssignSharedTaskRequest>,
) -> Result<ResponseJson<ApiResponse<RemoteSharedTaskResponse>>, ApiError> {
    let Ok(publisher) = deployment.share_publisher() else {
        return Err(ShareError::MissingConfig("share publisher unavailable").into());
    };

    let updated_shared_task = publisher
        .assign_shared_task(shared_task_id, payload.new_assignee_user_id.clone())
        .await?;

    Ok(ResponseJson(ApiResponse::success(updated_shared_task)))
}

pub async fn delete_shared_task(
    Path(shared_task_id): Path<Uuid>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let Ok(publisher) = deployment.share_publisher() else {
        return Err(ShareError::MissingConfig("share publisher unavailable").into());
    };

    publisher.delete_shared_task(shared_task_id).await?;

    Ok(ResponseJson(ApiResponse::success(())))
}

pub async fn link_shared_task_to_local(
    State(deployment): State<DeploymentImpl>,
    Json(shared_task_details): Json<SharedTaskDetails>,
) -> Result<ResponseJson<ApiResponse<Option<Task>>>, ApiError> {
    let Ok(publisher) = deployment.share_publisher() else {
        return Err(ShareError::MissingConfig("share publisher unavailable").into());
    };

    let task = publisher.link_shared_task(shared_task_details).await?;

    Ok(ResponseJson(ApiResponse::success(task)))
}
