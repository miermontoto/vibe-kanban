use axum::{
    Json,
    Router,
    extract::State,
    response::Json as ResponseJson,
    routing::{delete, get, post, put},
};
use db::models::task_label::{CreateTaskLabel, TaskLabel, UpdateTaskLabel};
use deployment::Deployment;
use serde::Serialize;
use ts_rs::TS;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{error::ApiError, DeploymentImpl};

pub fn routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/projects/{project_id}/labels", get(get_labels))
        .route("/projects/{project_id}/labels", post(create_label))
        .route("/projects/{project_id}/labels/{label_id}", put(update_label))
        .route(
            "/projects/{project_id}/labels/{label_id}",
            delete(delete_label),
        )
}

#[derive(Debug, Serialize, TS)]
pub struct GetLabelsResponse {
    pub labels: Vec<TaskLabel>,
}

/// obtener todas las etiquetas de un proyecto
pub async fn get_labels(
    State(deployment): State<DeploymentImpl>,
    axum::extract::Path(project_id): axum::extract::Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<GetLabelsResponse>>, ApiError> {
    let labels = TaskLabel::find_by_project_id(&deployment.db().pool, project_id).await?;

    Ok(ResponseJson(ApiResponse::success(GetLabelsResponse {
        labels,
    })))
}

/// crear nueva etiqueta
pub async fn create_label(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateTaskLabel>,
) -> Result<ResponseJson<ApiResponse<TaskLabel>>, ApiError> {
    let label = TaskLabel::create(&deployment.db().pool, &payload).await?;

    deployment
        .track_if_analytics_allowed(
            "task_label_created",
            serde_json::json!({
                "label_id": label.id.to_string(),
                "project_id": label.project_id.to_string(),
            }),
        )
        .await;

    Ok(ResponseJson(ApiResponse::success(label)))
}

/// actualizar etiqueta existente
pub async fn update_label(
    State(deployment): State<DeploymentImpl>,
    axum::extract::Path((_project_id, label_id)): axum::extract::Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateTaskLabel>,
) -> Result<ResponseJson<ApiResponse<TaskLabel>>, ApiError> {
    let label = TaskLabel::update(&deployment.db().pool, label_id, &payload).await?;

    Ok(ResponseJson(ApiResponse::success(label)))
}

/// eliminar etiqueta
pub async fn delete_label(
    State(deployment): State<DeploymentImpl>,
    axum::extract::Path((_project_id, label_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    TaskLabel::delete(&deployment.db().pool, label_id).await?;

    Ok(ResponseJson(ApiResponse::success(())))
}
