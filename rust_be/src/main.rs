use actix_web::{App, HttpServer, middleware::Logger, web};
use rust_be::{config::Config, routes};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = Config::from_env();
    let addr = (config.host.clone(), config.port);
    println!("listening on http://{}:{}", addr.0, addr.1);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(config.clone()))
            .wrap(Logger::default())
            .configure(routes::configure)
    })
    .bind(addr)?
    .run()
    .await
}
