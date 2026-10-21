pub mod types;

use reqwest::{Client, RequestBuilder};
use serde::{Serialize, de::DeserializeOwned};

use crate::error::AppError;

const DEFAULT_BASE_URL: &str = "https://api.changenow.io/v2";
const API_KEY_HEADER: &str = "x-changenow-api-key";

#[derive(Clone, Debug)]
pub struct ChangeNowClient {
    http: Client,
    base_url: String,
    api_key: String,
}

impl ChangeNowClient {
    pub fn new(base_url: Option<String>, api_key: String) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url
                .unwrap_or_else(|| DEFAULT_BASE_URL.into())
                .trim_end_matches("/")
                .to_string(),
            api_key,
        }
    }

    pub fn url(&self, path: &str) -> String {
        format!("{}/{}", self.base_url, path.trim_start_matches("/"))
    }

    async fn get<T, Q>(&self, path: &str, query: &Q) -> Result<T, AppError>
    where
        T: DeserializeOwned,
        Q: Serialize + ?Sized,
    {
        let req = self.http.get(self.url(path)).query(query);
        self.send(req).await
    }

    async fn post<T, B>(&self, path: &str, body: &B) -> Result<T, AppError>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        let req = self.http.post(self.url(path)).json(body);
        self.send(req).await
    }

    async fn send<T: DeserializeOwned>(&self, req: RequestBuilder) -> Result<T, AppError> {
        let res = req
            .header(API_KEY_HEADER, &self.api_key)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("changenow request failed: {e}")))?;

        let status = res.status();

        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(if status.is_client_error() {
                AppError::BadRequest(body)
            } else {
                AppError::Internal(format!("changenow returned {status}: {body}"))
            });
        }

        res.json::<T>()
            .await
            .map_err(|e| AppError::Internal(format!("changenow response decode failed: {e}")))
    }
}
