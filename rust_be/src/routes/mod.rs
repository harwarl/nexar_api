use actix_web::web;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod health;
mod swap;
mod transfer;

#[derive(OpenApi)]
#[openapi(paths(health::health))]
struct HealthApi;

#[derive(OpenApi)]
#[openapi(paths(
    swap::get_tokens,
    swap::get_minimal_amount,
    swap::get_exchange_amount,
    swap::get_transaction_details,
    swap::create_transaction,
))]
struct SwapApi;

#[derive(OpenApi)]
#[openapi(paths(transfer::get_estimate, transfer::create_transfer))]
struct TransferApi;

#[derive(OpenApi)]
#[openapi(
    info(title = "Nexar API"),
    nest(
        (path = "/api/v1", api = HealthApi),
        (path = "/api/v1/swap", api = SwapApi),
        (path = "/api/v1/transfer", api = TransferApi),
    ),
    tags(
        (name = "health", description = "Service health"),
        (name = "swap", description = "Token swaps via ChangeNow"),
        (name = "transfer", description = "Private same-currency transfers via ChangeNow"),
    )
)]
pub struct ApiDoc;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        SwaggerUi::new("/swagger-ui/{_:.*}").url("/api-docs/openapi.json", ApiDoc::openapi()),
    )
    .service(
        web::scope("/api/v1")
            .service(health::health)
            .service(
                web::scope("/swap")
                    .service(swap::get_tokens)
                    .service(swap::get_minimal_amount)
                    .service(swap::get_exchange_amount)
                    .service(swap::get_transaction_details)
                    .service(swap::create_transaction)
            )
            .service(
                web::scope("/transfer")
                    .service(transfer::get_estimate)
                    .service(transfer::create_transfer)
            )
    );
}
