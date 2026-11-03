use actix_web::{Responder, Result, get, web};
use serde_json::json;

use crate::{error::AppError, models::ApiResponse};

/// Health check.
#[utoipa::path(
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = ApiResponse<String>,
            example = json!({ "status": "healthy", "data": null, "message": null })),
    )
)]
#[get("/health")]
pub async fn health() -> Result<impl Responder, AppError> {
    let response = json!( ApiResponse::<()>{
        status: "healthy".into(),
        data: None,
        message: None
    });

    Ok(web::Json(response))
}
