use actix_web::{App, HttpServer, middleware::Logger, web};
use rust_be::{
    config::Config,
    provider::changenow::ChangeNowClient,
    routes,
    services::{SwapService, TransferService},
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = Config::from_env();
    let addr = (config.host.clone(), config.port);
    println!("listening on http://{}:{}", addr.0, addr.1);

    let changenow = ChangeNowClient::new(
        config.changenow_base_url.clone(),
        config.changenow_api_key.clone(),
    );

    let swap_service = web::Data::new(SwapService::new(changenow.clone()));
    let transfer_service = web::Data::new(TransferService::new(changenow));

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(config.clone()))
            .app_data(swap_service.clone())
            .app_data(transfer_service.clone())
            .wrap(Logger::default())
            .configure(routes::configure)
    })
    .bind(addr)?
    .run()
    .await
}
