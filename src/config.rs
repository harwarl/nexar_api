use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub changenow_api_key: String,
    pub changenow_base_url: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        // Load `.env` if present; real environment variables take precedence.
        dotenvy::dotenv().ok();

        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            changenow_api_key: env::var("CHANGENOW_API_KEY")
                .expect("CHANGENOW_API_KEY must be set"),
            changenow_base_url: env::var("CHANGENOW_BASE_URL").ok(),
        }
    }
}
