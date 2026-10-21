use actix_web::{Responder, get, post};
use crate::error::AppError;

#[get("/tokens")]
pub async fn get_tokens() -> Result<impl Responder, AppError> {
    Ok("Get tokens endpoint")
}

#[get("/minimal-amount")]   
pub async fn get_minimal_amount() -> Result<impl Responder, AppError> {
    Ok("Get minimal amount endpoint")
}

#[get("/exchange-amount")]
pub async fn get_exchange_amount() -> Result<impl Responder, AppError> {
    Ok("Get exchange amount endpoint")
}

#[get("/transaction-details")]
pub async fn get_transaction_details() -> Result<impl Responder, AppError> {
    Ok("Get transaction details endpoint")
}

#[post("/create-transaction")]
pub async fn create_transaction() -> Result<impl Responder, AppError> {
    Ok("Create transaction endpoint")
}
