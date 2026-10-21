use actix_web::{Responder, Result, get, web};
use serde_json::json;

use crate::{error::AppError, models::ApiResponse};

#[get("/health")]
pub async fn health() -> Result<impl Responder, AppError> {
    let response = json!( ApiResponse::<()>{
        status: "healthy".into(),
        data: None,
        message: None
    });

    Ok(web::Json(response))
}
