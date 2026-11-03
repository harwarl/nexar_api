use actix_web::{HttpRequest, Responder, get, post, web};
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

use crate::{
    error::AppError,
    models::ApiResponse,
    provider::changenow::types::{
        CreatedTransaction, Currency, EstimateQuery, EstimatedExchangeAmount, ExchangePair,
        MinimalExchangeAmount, TransactionStatus,
    },
    services::{SwapService, swap::CreateSwapRequest},
};

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct TransactionQuery {
    /// ChangeNow transaction id.
    pub id: String,
}

/// List the tokens available for swapping.
#[utoipa::path(
    tag = "swap",
    responses(
        (status = 200, description = "Listed tokens", body = ApiResponse<Vec<Currency>>),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[get("/tokens")]
pub async fn get_tokens(swap: web::Data<SwapService>) -> Result<impl Responder, AppError> {
    Ok(web::Json(ApiResponse::success(swap.get_tokens().await?)))
}

/// Get the minimal amount that can be exchanged for a currency pair.
#[utoipa::path(
    tag = "swap",
    params(ExchangePair),
    responses(
        (status = 200, description = "Minimal exchange amount", body = ApiResponse<MinimalExchangeAmount>),
        (status = 400, description = "Invalid currency pair", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[get("/minimal-amount")]
pub async fn get_minimal_amount(
    swap: web::Data<SwapService>,
    query: web::Query<ExchangePair>,
) -> Result<impl Responder, AppError> {
    let res = swap.get_minimal_amount(query.into_inner()).await?;
    Ok(web::Json(ApiResponse::success(res)))
}

/// Estimate the exchange amount for a currency pair.
///
/// Provide `fromAmount` for a direct estimate or `toAmount` for a reverse estimate.
#[utoipa::path(
    tag = "swap",
    params(EstimateQuery),
    responses(
        (status = 200, description = "Estimated exchange amount", body = ApiResponse<EstimatedExchangeAmount>),
        (status = 400, description = "Invalid query", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[get("/exchange-amount")]
pub async fn get_exchange_amount(
    swap: web::Data<SwapService>,
    query: web::Query<EstimateQuery>,
) -> Result<impl Responder, AppError> {
    let res = swap.get_exchange_amount(query.into_inner()).await?;
    Ok(web::Json(ApiResponse::success(res)))
}

/// Get the status and details of a transaction.
#[utoipa::path(
    tag = "swap",
    params(TransactionQuery),
    responses(
        (status = 200, description = "Transaction details", body = ApiResponse<TransactionStatus>),
        (status = 400, description = "Missing id", body = String, content_type = "text/html"),
        (status = 404, description = "Transaction not found", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[get("/transaction-details")]
pub async fn get_transaction_details(
    swap: web::Data<SwapService>,
    query: web::Query<TransactionQuery>,
) -> Result<impl Responder, AppError> {
    let res = swap.get_transaction_details(&query.id).await?;
    Ok(web::Json(ApiResponse::success(res)))
}

/// Create a swap transaction.
///
/// `rateId` is required when `flow` is `fixed-rate`.
#[utoipa::path(
    tag = "swap",
    request_body = CreateSwapRequest,
    responses(
        (status = 200, description = "Created transaction", body = ApiResponse<CreatedTransaction>),
        (status = 400, description = "Invalid request", body = String, content_type = "text/html"),
        (status = 500, description = "Upstream provider error", body = String, content_type = "text/html"),
    )
)]
#[post("/create-transaction")]
pub async fn create_transaction(
    req: HttpRequest,
    swap: web::Data<SwapService>,
    body: web::Json<CreateSwapRequest>,
) -> Result<impl Responder, AppError> {
    // Honors `Forwarded`/`X-Forwarded-For` from a reverse proxy, falling back to the peer address.
    let client_ip = req.connection_info().realip_remote_addr().map(str::to_owned);
    let res = swap
        .create_transaction(body.into_inner(), client_ip.as_deref())
        .await?;
    Ok(web::Json(ApiResponse::success(res)))
}
