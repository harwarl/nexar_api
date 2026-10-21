use actix_web::web;

mod health;
mod swap;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
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
    );
}
