use axum::{
    Router,
    extract::{Json, Path, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{delete, get, patch, post},
};
use deployment::Deployment;
use utils::{
    api::{
        organizations::{
            AcceptInvitationResponse, CreateInvitationRequest, CreateInvitationResponse,
            CreateOrganizationRequest, CreateOrganizationResponse, GetInvitationResponse,
            GetOrganizationResponse, ListInvitationsResponse, ListMembersResponse,
            ListOrganizationsResponse, Organization, RevokeInvitationRequest,
            UpdateMemberRoleRequest, UpdateMemberRoleResponse, UpdateOrganizationRequest,
        },
        projects::RemoteProject,
    },
    response::ApiResponse,
};
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/organizations", get(list_organizations))
        .route("/organizations", post(create_organization))
        .route("/organizations/{id}", get(get_organization))
        .route("/organizations/{id}", patch(update_organization))
        .route("/organizations/{id}", delete(delete_organization))
        .route(
            "/organizations/{org_id}/projects",
            get(list_organization_projects),
        )
        .route(
            "/organizations/{org_id}/invitations",
            post(create_invitation),
        )
        .route("/organizations/{org_id}/invitations", get(list_invitations))
        .route(
            "/organizations/{org_id}/invitations/revoke",
            post(revoke_invitation),
        )
        .route("/invitations/{token}", get(get_invitation))
        .route("/invitations/{token}/accept", post(accept_invitation))
        .route("/organizations/{org_id}/members", get(list_members))
        .route(
            "/organizations/{org_id}/members/{user_id}",
            delete(remove_member),
        )
        .route(
            "/organizations/{org_id}/members/{user_id}/role",
            patch(update_member_role),
        )
}

async fn list_organization_projects(
    State(deployment): State<DeploymentImpl>,
    Path(org_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<RemoteProject>>>, ApiError> {
    let client = deployment.remote_client()?;

    let response = client.list_projects(org_id).await?;

    Ok(ResponseJson(ApiResponse::success(response.projects)))
}

async fn list_organizations(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<ListOrganizationsResponse>>, ApiError> {
    let client = deployment.remote_client()?;

    let response = client.list_organizations().await?;

    Ok(ResponseJson(ApiResponse::success(response)))
}

async fn get_organization(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<GetOrganizationResponse>>, ApiError> {
    let client = deployment.remote_client()?;

    let response = client.get_organization(id).await?;

    Ok(ResponseJson(ApiResponse::success(response)))
}

async fn create_organization(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<CreateOrganizationRequest>,
) -> Result<ResponseJson<ApiResponse<CreateOrganizationResponse>>, ApiError> {
    let client = deployment.remote_client()?;

    let response = client.create_organization(&request).await?;

    Ok(ResponseJson(ApiResponse::success(response)))
}