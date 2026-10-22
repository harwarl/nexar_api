use actix_web::{Responder, get, post, web};

use crate::{
    error::AppError,
    models::ApiResponse,
    provider::changenow::types::{PrivateTransfer, PrivateTransferEstimate},
    services::{
        TransferService,
        transfer::{CreateTransferRequest, TransferEstimateQuery},
    },
};

/// Estimate a private transfer.
///
/// Returns the amount to deposit and a `rateId` to pass to create-transfer before `validUntil`.
#[utoipa::path(
    tag = "transfer",
    params(TransferEstimateQuery),
    responses(
        (status = 200, description = "Private transfer estimate", body = ApiResponse<PrivateTransferEstimate>),
        (status = 400, description = "Invalid query", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[get("/estimated-amount")]
pub async fn get_estimate(
    transfer: web::Data<TransferService>,
    query: web::Query<TransferEstimateQuery>,
) -> Result<impl Responder, AppError> {
    let res = transfer.get_estimate(query.into_inner()).await?;
    Ok(web::Json(ApiResponse::success(res)))
}

/// Create a private transfer.
///
/// The user sends `fromAmount` to `payinAddress`; the recipient receives `toAmount`.
#[utoipa::path(
    tag = "transfer",
    request_body = CreateTransferRequest,
    responses(
        (status = 200, description = "Created private transfer", body = ApiResponse<PrivateTransfer>),
        (status = 400, description = "Invalid request or expired rateId", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[post("/create-transfer")]
pub async fn create_transfer(
    transfer: web::Data<TransferService>,
    body: web::Json<CreateTransferRequest>,
) -> Result<impl Responder, AppError> {
    let res = transfer.create_transfer(body.into_inner()).await?;
    Ok(web::Json(ApiResponse::success(res)))
}
