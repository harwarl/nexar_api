use rust_decimal::Decimal;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::provider::changenow::{
    ChangeNowClient,
    types::{
        CreateTransaction, CreatedTransaction, CurrenciesQuery, Currency, EstimateQuery, EstimateType,
        EstimatedExchangeAmount, ExchangePair, Flow, MinimalExchangeAmount, TransactionStatus,
    },
};

// Tokens we list, matched against ChangeNow's v1-style `legacyTicker` (e.g. `usdterc20`),
// since the v2 `ticker` alone is ambiguous across networks.
const LISTED_TICKERS: &[&str] = &[
    "sui",
    "shib",
    "floki",
    "bonk",
    "op",
    "wbtcmatic",
    "maticusdce",
    "usdtmatic",
    "opusdce",
    "usdtop",
    "ethop",
    "daiop",
    "matic",
    "doge",
    "pepe",
    "avax",
    "usdc",
    "usdcbsc",
    "usdctrc20",
    "ton",
    "xrp",
    "near",
    "ada",
    "trump",
];
const LISTED_NAMES: &[&str] = &["Bitcoin", "Solana", "Ethereum"];
const LISTED_NAME_FRAGMENTS: &[&str] = &["BNB", "XRP"];
const LISTED_TICKER_FRAGMENTS: &[&str] = &["usdterc20"];

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSwapRequest {
    pub from_currency: String,
    pub to_currency: String,
    pub from_network: Option<String>,
    pub to_network: Option<String>,
    pub from_amount: Option<Decimal>,
    pub to_amount: Option<Decimal>,
    pub address: String,
    pub extra_id: Option<String>,
    pub refund_address: Option<String>,
    pub refund_extra_id: Option<String>,
    pub contact_email: Option<String>,
    pub flow: Option<Flow>,
    pub rate_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SwapService {
    changenow: ChangeNowClient,
}

impl SwapService {
    pub fn new(changenow: ChangeNowClient) -> Self {
        Self { changenow }
    }

    pub async fn get_tokens(&self) -> Result<Vec<Currency>, AppError> {
        let currencies = self
            .changenow
            .currencies(&CurrenciesQuery {
                active: Some(true),
                ..Default::default()
            })
            .await?;
        Ok(currencies.into_iter().filter(is_listed).collect())
    }

    pub async fn get_minimal_amount(
        &self,
        pair: ExchangePair,
    ) -> Result<MinimalExchangeAmount, AppError> {
        let pair = ExchangePair {
            from_currency: required("fromCurrency", &pair.from_currency)?,
            to_currency: required("toCurrency", &pair.to_currency)?,
            from_network: network(pair.from_network),
            to_network: network(pair.to_network),
            flow: pair.flow,
        };
        ensure_distinct(
            &pair.from_currency,
            &pair.from_network,
            &pair.to_currency,
            &pair.to_network,
        )?;

        self.changenow.min_amount(&pair).await
    }

    pub async fn get_exchange_amount(
        &self,
        query: EstimateQuery,
    ) -> Result<EstimatedExchangeAmount, AppError> {
        let flow = query.flow.unwrap_or(Flow::Standard);
        let (kind, from_amount, to_amount) =
            resolve_amounts(flow, query.r#type, query.from_amount, query.to_amount)?;

        let query = EstimateQuery {
            from_currency: required("fromCurrency", &query.from_currency)?,
            to_currency: required("toCurrency", &query.to_currency)?,
            from_network: network(query.from_network),
            to_network: network(query.to_network),
            from_amount,
            to_amount,
            flow: Some(flow),
            r#type: Some(kind),
            use_rate_id: query.use_rate_id,
        };
        ensure_distinct(
            &query.from_currency,
            &query.from_network,
            &query.to_currency,
            &query.to_network,
        )?;

        self.changenow.estimated_amount(&query).await
    }

    pub async fn get_transaction_details(&self, id: &str) -> Result<TransactionStatus, AppError> {
        let id = id.trim();
        if id.is_empty() {
            return Err(AppError::BadRequest("id is required".into()));
        }

        self.changenow.exchange_status(id).await
    }

    pub async fn create_transaction(
        &self,
        req: CreateSwapRequest,
        client_ip: Option<&str>,
    ) -> Result<CreatedTransaction, AppError> {
        let flow = req.flow.unwrap_or(Flow::Standard);
        let (kind, from_amount, to_amount) =
            resolve_amounts(flow, None, req.from_amount, req.to_amount)?;

        let rate_id = optional(req.rate_id);
        if flow == Flow::FixedRate && rate_id.is_none() {
            return Err(AppError::BadRequest(
                "rateId is required for fixed-rate swaps".into(),
            ));
        }

        let address = req.address.trim();
        if address.is_empty() {
            return Err(AppError::BadRequest("address is required".into()));
        }

        let tx = CreateTransaction {
            from_currency: required("fromCurrency", &req.from_currency)?,
            to_currency: required("toCurrency", &req.to_currency)?,
            from_network: network(req.from_network),
            to_network: network(req.to_network),
            address: address.to_string(),
            from_amount,
            to_amount,
            extra_id: optional(req.extra_id),
            refund_address: optional(req.refund_address),
            refund_extra_id: optional(req.refund_extra_id),
            contact_email: optional(req.contact_email),
            flow: Some(flow),
            r#type: Some(kind),
            rate_id,
            ..Default::default()
        };
        ensure_distinct(
            &tx.from_currency,
            &tx.from_network,
            &tx.to_currency,
            &tx.to_network,
        )?;

        self.changenow.create_exchange(&tx, client_ip).await
    }
}

fn is_listed(c: &Currency) -> bool {
    LISTED_NAMES.contains(&c.name.as_str())
        || LISTED_TICKERS.contains(&c.legacy_ticker.as_str())
        || LISTED_NAME_FRAGMENTS.iter().any(|f| c.name.contains(f))
        || LISTED_TICKER_FRAGMENTS
            .iter()
            .any(|f| c.legacy_ticker.contains(f))
}

pub(crate) fn required(field: &str, value: &str) -> Result<String, AppError> {
    let value = value.trim().to_lowercase();
    if value.is_empty() {
        return Err(AppError::BadRequest(format!("{field} is required")));
    }
    Ok(value)
}

/// Clients often send `""` for unset fields; ChangeNow rejects those, so treat them as absent.
pub(crate) fn optional(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

pub(crate) fn network(value: Option<String>) -> Option<String> {
    optional(value).map(|v| v.to_lowercase())
}

fn ensure_distinct(
    from: &str,
    from_network: &Option<String>,
    to: &str,
    to_network: &Option<String>,
) -> Result<(), AppError> {
    if from == to && from_network == to_network {
        return Err(AppError::BadRequest(
            "fromCurrency and toCurrency must differ".into(),
        ));
    }
    Ok(())
}

/// Picks direct vs reverse and keeps only the amount ChangeNow will read for it.
/// Reverse (fixed `toAmount`) is only supported on the fixed-rate flow.
fn resolve_amounts(
    flow: Flow,
    kind: Option<EstimateType>,
    from_amount: Option<Decimal>,
    to_amount: Option<Decimal>,
) -> Result<(EstimateType, Option<Decimal>, Option<Decimal>), AppError> {
    let kind = kind.unwrap_or(match (from_amount, to_amount) {
        (None, Some(_)) => EstimateType::Reverse,
        _ => EstimateType::Direct,
    });

    let positive = |field: &str, amount: Option<Decimal>| match amount {
        Some(a) if a > Decimal::ZERO => Ok(a),
        _ => Err(AppError::BadRequest(format!(
            "{field} must be greater than 0"
        ))),
    };

    match kind {
        EstimateType::Direct => Ok((kind, Some(positive("fromAmount", from_amount)?), None)),
        EstimateType::Reverse if flow != Flow::FixedRate => Err(AppError::BadRequest(
            "toAmount (reverse) swaps require the fixed-rate flow".into(),
        )),
        EstimateType::Reverse => Ok((kind, None, Some(positive("toAmount", to_amount)?))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};
    use wiremock::matchers::{body_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn service_for(server: &MockServer) -> SwapService {
        SwapService::new(ChangeNowClient::new(Some(server.uri()), "test-key".into()))
    }

    fn currency(ticker: &str, legacy: &str, name: &str) -> Value {
        json!({
            "ticker": ticker,
            "name": name,
            "image": "",
            "hasExternalId": false,
            "isExtraIdSupported": false,
            "isFiat": false,
            "featured": false,
            "isStable": false,
            "supportsFixedRate": true,
            "network": ticker,
            "tokenContract": null,
            "buy": true,
            "sell": true,
            "legacyTicker": legacy
        })
    }

    fn pair(from: &str, to: &str) -> ExchangePair {
        ExchangePair {
            from_currency: from.into(),
            to_currency: to.into(),
            ..Default::default()
        }
    }

    fn create_request() -> CreateSwapRequest {
        CreateSwapRequest {
            from_currency: "btc".into(),
            to_currency: "eth".into(),
            from_network: None,
            to_network: None,
            from_amount: Some(Decimal::new(123, 5)),
            to_amount: None,
            address: "0xabc".into(),
            extra_id: None,
            refund_address: None,
            refund_extra_id: None,
            contact_email: None,
            flow: None,
            rate_id: None,
        }
    }

    fn expect_bad_request<T: std::fmt::Debug>(res: Result<T, AppError>, needle: &str) {
        match res {
            Err(AppError::BadRequest(msg)) => assert!(msg.contains(needle), "{msg}"),
            other => panic!("expected BadRequest containing {needle:?}, got {other:?}"),
        }
    }

    /// Fails the test if the service reaches ChangeNow at all.
    async fn mount_unreachable(server: &MockServer) {
        Mock::given(wiremock::matchers::any())
            .respond_with(ResponseTemplate::new(500))
            .expect(0)
            .mount(server)
            .await;
    }

    // ---------- tokens ----------

    #[actix_web::test]
    async fn get_tokens_keeps_only_listed_currencies() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/currencies"))
            .and(query_param("active", "true"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!([
                currency("btc", "btc", "Bitcoin"),
                currency("usdt", "usdterc20", "Tether USD"),
                currency("bnb", "bnbbsc", "BNB Smart Chain"),
                currency("usdc", "usdcbsc", "USD Coin"),
                currency("xyz", "xyz", "Some Token"),
                currency("usdt", "usdttrc20", "Tether USD"),
            ])))
            .mount(&server)
            .await;

        let tokens = service_for(&server).get_tokens().await.unwrap();
        let legacy: Vec<_> = tokens.iter().map(|t| t.legacy_ticker.as_str()).collect();

        assert_eq!(legacy, ["btc", "usdterc20", "bnbbsc", "usdcbsc"]);
    }

    // ---------- minimal amount ----------

    #[actix_web::test]
    async fn get_minimal_amount_normalizes_and_forwards_pair() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/min-amount"))
            .and(query_param("fromCurrency", "btc"))
            .and(query_param("toCurrency", "eth"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromCurrency": "btc", "fromNetwork": "btc",
                "toCurrency": "eth", "toNetwork": "eth",
                "flow": "standard", "minAmount": 0.0012
            })))
            .expect(1)
            .mount(&server)
            .await;

        let res = service_for(&server)
            .get_minimal_amount(pair(" BTC ", "Eth"))
            .await
            .unwrap();

        assert_eq!(res.min_amount, Decimal::new(12, 4));
    }

    #[actix_web::test]
    async fn get_minimal_amount_rejects_bad_pairs_without_calling_provider() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;
        let service = service_for(&server);

        expect_bad_request(
            service.get_minimal_amount(pair("btc", "BTC")).await,
            "must differ",
        );
        expect_bad_request(
            service.get_minimal_amount(pair(" ", "eth")).await,
            "fromCurrency",
        );
    }

    #[actix_web::test]
    async fn same_ticker_on_different_networks_is_allowed() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/min-amount"))
            .and(query_param("fromNetwork", "eth"))
            .and(query_param("toNetwork", "sol"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromCurrency": "usdt", "fromNetwork": "eth",
                "toCurrency": "usdt", "toNetwork": "sol",
                "flow": "standard", "minAmount": 10
            })))
            .expect(1)
            .mount(&server)
            .await;

        let mut p = pair("usdt", "usdt");
        p.from_network = Some("eth".into());
        p.to_network = Some("sol".into());

        service_for(&server).get_minimal_amount(p).await.unwrap();
    }

    // ---------- exchange amount ----------

    #[actix_web::test]
    async fn get_exchange_amount_sends_direct_estimate() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/estimated-amount"))
            .and(query_param("fromCurrency", "btc"))
            .and(query_param("toCurrency", "eth"))
            .and(query_param("fromAmount", "0.5"))
            .and(query_param("flow", "standard"))
            .and(query_param("type", "direct"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "fromCurrency": "btc", "fromNetwork": "btc",
                "toCurrency": "eth", "toNetwork": "eth",
                "flow": "standard", "type": "direct",
                "rateId": null, "validUntil": null,
                "transactionSpeedForecast": "10-60",
                "warningMessage": null,
                "fromAmount": 0.5, "toAmount": 15.2
            })))
            .expect(1)
            .mount(&server)
            .await;

        let res = service_for(&server)
            .get_exchange_amount(EstimateQuery {
                from_currency: "btc".into(),
                to_currency: "eth".into(),
                from_amount: Some(Decimal::new(5, 1)),
                ..Default::default()
            })
            .await
            .unwrap();

        assert_eq!(res.to_amount, Decimal::new(152, 1));
    }

    #[actix_web::test]
    async fn get_exchange_amount_validates_amounts() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;
        let service = service_for(&server);
        let base = EstimateQuery {
            from_currency: "btc".into(),
            to_currency: "eth".into(),
            ..Default::default()
        };

        expect_bad_request(
            service.get_exchange_amount(base.clone()).await,
            "fromAmount",
        );
        expect_bad_request(
            service
                .get_exchange_amount(EstimateQuery {
                    from_amount: Some(Decimal::ZERO),
                    ..base.clone()
                })
                .await,
            "fromAmount",
        );
        // toAmount alone implies reverse, which needs fixed-rate.
        expect_bad_request(
            service
                .get_exchange_amount(EstimateQuery {
                    to_amount: Some(Decimal::ONE),
                    ..base
                })
                .await,
            "fixed-rate",
        );
    }

    // ---------- transaction details ----------

    #[actix_web::test]
    async fn get_transaction_details_fetches_by_id() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/exchange/by-id"))
            .and(query_param("id", "abc123"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "id": "abc123", "status": "waiting", "actionsAvailable": false,
                "fromCurrency": "btc", "fromNetwork": "btc",
                "toCurrency": "eth", "toNetwork": "eth",
                "fromLegacyTicker": "btc", "toLegacyTicker": "eth",
                "expectedAmountFrom": 0.5, "expectedAmountTo": 15.2,
                "amountFrom": null, "amountTo": null, "refundAmount": null,
                "payinAddress": "bc1q", "payoutAddress": "0xabc",
                "createdAt": "2026-10-22T10:00:00.000Z",
                "updatedAt": "2026-10-22T10:00:00.000Z"
            })))
            .expect(1)
            .mount(&server)
            .await;

        let tx = service_for(&server)
            .get_transaction_details(" abc123 ")
            .await
            .unwrap();

        assert_eq!(tx.id, "abc123");
        assert!(!tx.status.is_terminal());
    }

    #[actix_web::test]
    async fn get_transaction_details_requires_id() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;

        expect_bad_request(
            service_for(&server).get_transaction_details("  ").await,
            "id",
        );
    }

    // ---------- create transaction ----------

    #[actix_web::test]
    async fn create_transaction_drops_empty_optionals_and_posts() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/exchange"))
            .and(header("x-forwarded-for", "203.0.113.7"))
            .and(body_json(json!({
                "fromCurrency": "btc",
                "toCurrency": "eth",
                "address": "0xabc",
                "fromAmount": 0.00123,
                "flow": "standard",
                "type": "direct"
            })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "id": "tx1", "fromAmount": 0.00123, "toAmount": 0.037,
                "flow": "standard", "type": "direct",
                "payinAddress": "bc1q", "payoutAddress": "0xabc",
                "fromCurrency": "btc", "fromNetwork": "btc",
                "toCurrency": "eth", "toNetwork": "eth"
            })))
            .expect(1)
            .mount(&server)
            .await;

        let req = CreateSwapRequest {
            from_currency: "BTC".into(),
            address: " 0xabc ".into(),
            extra_id: Some("".into()),
            refund_address: Some("  ".into()),
            contact_email: Some("".into()),
            ..create_request()
        };
        let tx = service_for(&server)
            .create_transaction(req, Some("203.0.113.7"))
            .await
            .unwrap();

        assert_eq!(tx.id, "tx1");
        assert_eq!(tx.payin_address, "bc1q");
    }

    #[actix_web::test]
    async fn create_transaction_validates_before_calling_provider() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;
        let service = service_for(&server);

        expect_bad_request(
            service
                .create_transaction(CreateSwapRequest {
                    address: " ".into(),
                    ..create_request()
                }, None)
                .await,
            "address",
        );
        expect_bad_request(
            service
                .create_transaction(CreateSwapRequest {
                    from_amount: None,
                    ..create_request()
                }, None)
                .await,
            "fromAmount",
        );
        expect_bad_request(
            service
                .create_transaction(CreateSwapRequest {
                    flow: Some(Flow::FixedRate),
                    ..create_request()
                }, None)
                .await,
            "rateId",
        );
    }
}
