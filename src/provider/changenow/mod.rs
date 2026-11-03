pub mod types;

use reqwest::{Client, RequestBuilder, StatusCode};
use serde::{Serialize, de::DeserializeOwned};

use crate::error::AppError;
use types::{
    ApiError, AvailablePair, AvailablePairsQuery, CreatePrivateTransfer, CreateTransaction,
    CreatedTransaction, CurrenciesQuery, Currency, EstimateQuery, EstimatedExchangeAmount,
    ExchangePair, ExchangeRange, MinimalExchangeAmount, PrivateTransfer, PrivateTransferEstimate,
    PrivateTransferEstimateQuery, TransactionStatus,
};

const DEFAULT_BASE_URL: &str = "https://api.changenow.io/v2";
const API_KEY_HEADER: &str = "x-changenow-api-key";
// End user's IP, forwarded to ChangeNow when creating an exchange.
const FORWARDED_FOR_HEADER: &str = "x-forwarded-for";

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

    // ---------- market info ----------

    /// `GET /v2/exchange/currencies`
    pub async fn currencies(&self, query: &CurrenciesQuery) -> Result<Vec<Currency>, AppError> {
        self.get("exchange/currencies", query).await
    }

    /// `GET /v2/exchange/available-pairs`
    pub async fn available_pairs(
        &self,
        query: &AvailablePairsQuery,
    ) -> Result<Vec<AvailablePair>, AppError> {
        self.get("exchange/available-pairs", query).await
    }

    /// `GET /v2/exchange/min-amount`
    pub async fn min_amount(&self, pair: &ExchangePair) -> Result<MinimalExchangeAmount, AppError> {
        self.get("exchange/min-amount", pair).await
    }

    /// `GET /v2/exchange/range`
    pub async fn exchange_range(&self, pair: &ExchangePair) -> Result<ExchangeRange, AppError> {
        self.get("exchange/range", pair).await
    }

    /// `GET /v2/exchange/estimated-amount`
    pub async fn estimated_amount(
        &self,
        query: &EstimateQuery,
    ) -> Result<EstimatedExchangeAmount, AppError> {
        self.get("exchange/estimated-amount", query).await
    }

    // ---------- exchanges ----------

    /// `POST /v2/exchange`. `client_ip` is the end user's IP, sent as `x-forwarded-for`.
    pub async fn create_exchange(
        &self,
        tx: &CreateTransaction,
        client_ip: Option<&str>,
    ) -> Result<CreatedTransaction, AppError> {
        let mut req = self.http.post(self.url("exchange")).json(tx);
        if let Some(ip) = client_ip {
            req = req.header(FORWARDED_FOR_HEADER, ip);
        }
        self.send(req).await
    }

    /// `GET /v2/exchange/by-id`
    pub async fn exchange_status(&self, id: &str) -> Result<TransactionStatus, AppError> {
        self.get("exchange/by-id", &[("id", id)]).await
    }

    // ---------- private transfers ----------

    /// `GET /v2/private-transfer/estimated-amount`
    pub async fn private_transfer_estimate(
        &self,
        query: &PrivateTransferEstimateQuery,
    ) -> Result<PrivateTransferEstimate, AppError> {
        self.get("private-transfer/estimated-amount", query).await
    }

    /// `POST /v2/private-transfer`
    pub async fn create_private_transfer(
        &self,
        transfer: &CreatePrivateTransfer,
    ) -> Result<PrivateTransfer, AppError> {
        self.post("private-transfer", transfer).await
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
            return Err(map_error(status, body));
        }

        res.json::<T>()
            .await
            .map_err(|e| AppError::Internal(format!("changenow response decode failed: {e}")))
    }
}

/// Maps a ChangeNow error response to an `AppError`, surfacing the `message` from
/// its `{"error", "message"}` body when present.
fn map_error(status: StatusCode, body: String) -> AppError {
    let parsed = serde_json::from_str::<ApiError>(&body).ok();
    let message = parsed
        .as_ref()
        .and_then(|e| e.message.clone().or_else(|| e.error.clone()))
        .unwrap_or(body);

    match status {
        // Our API key was rejected; not something the caller can fix.
        StatusCode::UNAUTHORIZED => {
            AppError::Internal(format!("changenow rejected the API key: {message}"))
        }
        // Only trust 404s that carry ChangeNow's error body; a bare 404 likely means a bad base URL.
        StatusCode::NOT_FOUND if parsed.is_some() => AppError::NotFound(message),
        s if s.is_client_error() => AppError::BadRequest(message),
        s => AppError::Internal(format!("changenow returned {s}: {message}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use serde_json::json;
    use wiremock::matchers::{body_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    const KEY: &str = "test-key";

    #[derive(Debug, Deserialize, PartialEq)]
    struct Echo {
        ok: bool,
    }

    async fn client_for(server: &MockServer) -> ChangeNowClient {
        ChangeNowClient::new(Some(server.uri()), KEY.into())
    }

    // ---------- new / url ----------

    #[test]
    fn new_uses_default_base_url() {
        let client = ChangeNowClient::new(None, KEY.into());
        assert_eq!(client.base_url, DEFAULT_BASE_URL);
        assert_eq!(client.api_key, KEY);
    }

    #[test]
    fn new_trims_trailing_slashes() {
        let client = ChangeNowClient::new(Some("https://example.com/v2//".into()), KEY.into());
        assert_eq!(client.base_url, "https://example.com/v2");
    }

    #[test]
    fn url_joins_with_single_slash() {
        let client = ChangeNowClient::new(Some("https://example.com/v2/".into()), KEY.into());
        assert_eq!(client.url("exchange"), "https://example.com/v2/exchange");
        assert_eq!(client.url("/exchange"), "https://example.com/v2/exchange");
        assert_eq!(client.url("exchange/currencies"), "https://example.com/v2/exchange/currencies");
    }

    // ---------- get / post ----------

    #[actix_web::test]
    async fn get_sends_api_key_and_query_and_decodes() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/min-amount"))
            .and(header(API_KEY_HEADER, KEY))
            .and(query_param("fromCurrency", "btc"))
            .and(query_param("toCurrency", "eth"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "ok": true })))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let res: Echo = client
            .get("/exchange/min-amount", &[("fromCurrency", "btc"), ("toCurrency", "eth")])
            .await
            .unwrap();

        assert_eq!(res, Echo { ok: true });
    }

    #[actix_web::test]
    async fn post_sends_api_key_and_json_body_and_decodes() {
        let server = MockServer::start().await;
        let body = json!({ "fromCurrency": "btc", "toCurrency": "eth", "address": "0xabc" });
        Mock::given(method("POST"))
            .and(path("/exchange"))
            .and(header(API_KEY_HEADER, KEY))
            .and(body_json(&body))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "ok": true })))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let res: Echo = client.post("exchange", &body).await.unwrap();

        assert_eq!(res, Echo { ok: true });
    }

    #[actix_web::test]
    async fn decodes_into_changenow_types() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/min-amount"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromCurrency": "btc",
                "fromNetwork": "btc",
                "toCurrency": "eth",
                "toNetwork": "eth",
                "flow": "standard",
                "minAmount": 0.0012
            })))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let res: types::MinimalExchangeAmount =
            client.get("exchange/min-amount", &()).await.unwrap();

        assert_eq!(res.from_currency, "btc");
        assert_eq!(res.flow, types::Flow::Standard);
        assert_eq!(res.min_amount.to_string(), "0.0012");
    }

    // ---------- error mapping ----------

    #[actix_web::test]
    async fn client_error_maps_to_bad_request_with_body() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(400).set_body_string("pair_is_inactive"))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.get::<Echo, _>("exchange", &()).await.unwrap_err();

        match err {
            AppError::BadRequest(msg) => assert_eq!(msg, "pair_is_inactive"),
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[actix_web::test]
    async fn client_error_surfaces_changenow_message() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(400).set_body_json(json!({
                "error": "not_valid_params",
                "message": "Currency btcc is not supported"
            })))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.get::<Echo, _>("exchange/min-amount", &()).await.unwrap_err();

        match err {
            AppError::BadRequest(msg) => assert_eq!(msg, "Currency btcc is not supported"),
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[actix_web::test]
    async fn changenow_not_found_maps_to_not_found() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(404).set_body_json(json!({
                "error": "not_found",
                "message": "Exchange not found"
            })))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.exchange_status("abc").await.unwrap_err();

        match err {
            AppError::NotFound(msg) => assert_eq!(msg, "Exchange not found"),
            other => panic!("expected NotFound, got {other:?}"),
        }
    }

    #[actix_web::test]
    async fn unauthorized_maps_to_internal() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(401).set_body_string("Unauthorized"))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.get::<Echo, _>("exchange/by-id", &()).await.unwrap_err();

        match err {
            AppError::Internal(msg) => assert!(msg.contains("API key"), "{msg}"),
            other => panic!("expected Internal, got {other:?}"),
        }
    }

    // ---------- endpoints ----------

    #[actix_web::test]
    async fn currencies_sends_filters() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/currencies"))
            .and(query_param("active", "true"))
            .and(query_param("flow", "fixed-rate"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!([])))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let res = client
            .currencies(&types::CurrenciesQuery {
                active: Some(true),
                flow: Some(types::Flow::FixedRate),
                ..Default::default()
            })
            .await
            .unwrap();

        assert!(res.is_empty());
    }

    #[actix_web::test]
    async fn create_exchange_forwards_client_ip_and_decodes_fixed_rate() {
        let server = MockServer::start().await;
        // Fixed-rate example response from the ChangeNow v2 docs.
        Mock::given(method("POST"))
            .and(path("/exchange"))
            .and(header(FORWARDED_FOR_HEADER, "203.0.113.7"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromAmount": 0.01,
                "toAmount": 1.82349294,
                "flow": "fixed-rate",
                "type": "direct",
                "payinAddress": "3CRNkN3kjHfxs7AAojPmGQo614f7XHmgWT",
                "payoutAddress": "0x57f31ad4b64095347F87eDB1675566DAfF5EC886",
                "fromCurrency": "btc",
                "toCurrency": "eth",
                "refundAddress": "135Hej8p1xSKoChWu5x6LSbNn5opgpojGn",
                "validUntil": "2023-11-07T10:09:46.517Z",
                "id": "af2fa90dab60d8",
                "fromNetwork": "btc",
                "toNetwork": "eth"
            })))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let tx = client
            .create_exchange(&CreateTransaction::default(), Some("203.0.113.7"))
            .await
            .unwrap();

        assert_eq!(tx.id, "af2fa90dab60d8");
        assert_eq!(tx.flow, Some(types::Flow::FixedRate));
        assert!(tx.valid_until.is_some());
    }

    #[actix_web::test]
    async fn exchange_range_decodes_null_max() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/range"))
            .and(query_param("fromCurrency", "btc"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromCurrency": "btc", "fromNetwork": "btc",
                "toCurrency": "eth", "toNetwork": "eth",
                "flow": "standard", "minAmount": 0.0046, "maxAmount": null
            })))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let range = client
            .exchange_range(&ExchangePair {
                from_currency: "btc".into(),
                to_currency: "eth".into(),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(range.min_amount.to_string(), "0.0046");
        assert!(range.max_amount.is_none());
    }

    #[actix_web::test]
    async fn private_transfer_estimate_decodes_string_amounts() {
        let server = MockServer::start().await;
        // The docs show amounts as strings for private transfers.
        Mock::given(method("GET"))
            .and(path("/private-transfer/estimated-amount"))
            .and(query_param("currency", "eth"))
            .and(query_param("toAmount", "10"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "currency": "eth", "network": "eth",
                "fromAmount": "10.10113071", "toAmount": "10",
                "rateId": "abc", "validUntil": "2026-03-23T10:30:36.779Z",
                "warningMessage": null
            })))
            .expect(1)
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let est = client
            .private_transfer_estimate(&types::PrivateTransferEstimateQuery {
                currency: "eth".into(),
                network: "eth".into(),
                to_amount: 10.into(),
                user_id: None,
            })
            .await
            .unwrap();

        assert_eq!(est.from_amount.to_string(), "10.10113071");
        assert_eq!(est.rate_id, "abc");
    }

    #[actix_web::test]
    async fn server_error_maps_to_internal_with_status() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(503).set_body_string("maintenance"))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.post::<Echo, _>("exchange", &json!({})).await.unwrap_err();

        match err {
            AppError::Internal(msg) => {
                assert!(msg.contains("503"), "{msg}");
                assert!(msg.contains("maintenance"), "{msg}");
            }
            other => panic!("expected Internal, got {other:?}"),
        }
    }

    #[actix_web::test]
    async fn invalid_json_maps_to_internal_decode_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not json"))
            .mount(&server)
            .await;

        let client = client_for(&server).await;
        let err = client.get::<Echo, _>("exchange", &()).await.unwrap_err();

        match err {
            AppError::Internal(msg) => assert!(msg.contains("decode failed"), "{msg}"),
            other => panic!("expected Internal, got {other:?}"),
        }
    }

    #[actix_web::test]
    async fn connection_failure_maps_to_internal_request_error() {
        // Bind to grab a free port, then drop the listener so nothing is listening.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();

        let client = ChangeNowClient::new(Some(format!("http://127.0.0.1:{port}")), KEY.into());
        let err = client.get::<Echo, _>("exchange", &()).await.unwrap_err();

        match err {
            AppError::Internal(msg) => assert!(msg.contains("request failed"), "{msg}"),
            other => panic!("expected Internal, got {other:?}"),
        }
    }
}
