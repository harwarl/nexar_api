use rust_decimal::Decimal;
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

use crate::error::AppError;
use crate::provider::changenow::{
    ChangeNowClient,
    types::{
        CreatePrivateTransfer, PrivateTransfer, PrivateTransferEstimate,
        PrivateTransferEstimateQuery,
    },
};
use crate::services::swap::{optional, required};

#[derive(Debug, Clone, Deserialize, ToSchema, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct TransferEstimateQuery {
    /// Ticker of the currency to transfer, e.g. `eth`.
    pub currency: String,
    /// Network of the currency, e.g. `eth`.
    pub network: String,
    /// Amount the recipient should receive.
    pub to_amount: Decimal,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransferRequest {
    pub currency: String,
    pub network: String,
    /// Amount the recipient should receive; must match the estimate.
    pub to_amount: Decimal,
    /// Recipient address.
    pub address: String,
    /// `rateId` from the estimate endpoint, valid until its `validUntil`.
    pub rate_id: String,
    pub extra_id: Option<String>,
    pub refund_address: Option<String>,
    pub refund_extra_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct TransferService {
    changenow: ChangeNowClient,
}

impl TransferService {
    pub fn new(changenow: ChangeNowClient) -> Self {
        Self { changenow }
    }

    pub async fn get_estimate(
        &self,
        query: TransferEstimateQuery,
    ) -> Result<PrivateTransferEstimate, AppError> {
        let query = PrivateTransferEstimateQuery {
            currency: required("currency", &query.currency)?,
            network: required("network", &query.network)?,
            to_amount: positive("toAmount", query.to_amount)?,
            user_id: None,
        };

        self.changenow.private_transfer_estimate(&query).await
    }

    pub async fn create_transfer(
        &self,
        req: CreateTransferRequest,
    ) -> Result<PrivateTransfer, AppError> {
        let address = req.address.trim();
        if address.is_empty() {
            return Err(AppError::BadRequest("address is required".into()));
        }
        let rate_id = req.rate_id.trim();
        if rate_id.is_empty() {
            return Err(AppError::BadRequest("rateId is required".into()));
        }

        let transfer = CreatePrivateTransfer {
            currency: required("currency", &req.currency)?,
            network: required("network", &req.network)?,
            to_amount: positive("toAmount", req.to_amount)?,
            address: address.to_string(),
            rate_id: rate_id.to_string(),
            extra_id: optional(req.extra_id),
            refund_address: optional(req.refund_address),
            refund_extra_id: optional(req.refund_extra_id),
        };

        self.changenow.create_private_transfer(&transfer).await
    }
}

fn positive(field: &str, amount: Decimal) -> Result<Decimal, AppError> {
    if amount > Decimal::ZERO {
        Ok(amount)
    } else {
        Err(AppError::BadRequest(format!("{field} must be greater than 0")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use wiremock::matchers::{body_json, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn service_for(server: &MockServer) -> TransferService {
        TransferService::new(ChangeNowClient::new(Some(server.uri()), "test-key".into()))
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

    fn estimate_query() -> TransferEstimateQuery {
        TransferEstimateQuery {
            currency: " ETH ".into(),
            network: "Eth".into(),
            to_amount: 10.into(),
        }
    }

    fn create_request() -> CreateTransferRequest {
        CreateTransferRequest {
            currency: "usdt".into(),
            network: "eth".into(),
            to_amount: 10.into(),
            address: "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb".into(),
            rate_id: "rate-1".into(),
            extra_id: None,
            refund_address: None,
            refund_extra_id: None,
        }
    }

    // ---------- estimate ----------

    #[actix_web::test]
    async fn get_estimate_normalizes_query() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/private-transfer/estimated-amount"))
            .and(query_param("currency", "eth"))
            .and(query_param("network", "eth"))
            .and(query_param("toAmount", "10"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "currency": "eth", "network": "eth",
                "fromAmount": "10.10113071", "toAmount": "10",
                "rateId": "rate-1", "validUntil": "2026-03-23T10:30:36.779Z",
                "warningMessage": null
            })))
            .expect(1)
            .mount(&server)
            .await;

        let est = service_for(&server).get_estimate(estimate_query()).await.unwrap();

        assert_eq!(est.rate_id, "rate-1");
        assert_eq!(est.from_amount.to_string(), "10.10113071");
    }

    #[actix_web::test]
    async fn get_estimate_validates_before_calling_provider() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;
        let service = service_for(&server);

        expect_bad_request(
            service
                .get_estimate(TransferEstimateQuery {
                    network: " ".into(),
                    ..estimate_query()
                })
                .await,
            "network",
        );
        expect_bad_request(
            service
                .get_estimate(TransferEstimateQuery {
                    to_amount: Decimal::ZERO,
                    ..estimate_query()
                })
                .await,
            "toAmount",
        );
    }

    // ---------- create ----------

    #[actix_web::test]
    async fn create_transfer_drops_empty_optionals_and_posts() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/private-transfer"))
            .and(body_json(json!({
                "currency": "usdt",
                "network": "eth",
                "toAmount": "10",
                "address": "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
                "rateId": "rate-1"
            })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "id": "366e345a27d6a1",
                "currency": "usdt", "network": "eth",
                "fromAmount": "10.10113071", "toAmount": "10",
                "payinAddress": "0x5a96bFF5F7E6822F0f81a7100F6D98A486ff6537",
                "payoutAddress": "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"
            })))
            .expect(1)
            .mount(&server)
            .await;

        let req = CreateTransferRequest {
            currency: "USDT".into(),
            address: " 0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb ".into(),
            extra_id: Some("".into()),
            refund_address: Some("  ".into()),
            ..create_request()
        };
        let transfer = service_for(&server).create_transfer(req).await.unwrap();

        assert_eq!(transfer.id, "366e345a27d6a1");
        assert!(transfer.payin_extra_id.is_none());
    }

    #[actix_web::test]
    async fn create_transfer_validates_before_calling_provider() {
        let server = MockServer::start().await;
        mount_unreachable(&server).await;
        let service = service_for(&server);

        expect_bad_request(
            service
                .create_transfer(CreateTransferRequest {
                    address: " ".into(),
                    ..create_request()
                })
                .await,
            "address",
        );
        expect_bad_request(
            service
                .create_transfer(CreateTransferRequest {
                    rate_id: "".into(),
                    ..create_request()
                })
                .await,
            "rateId",
        );
        expect_bad_request(
            service
                .create_transfer(CreateTransferRequest {
                    to_amount: Decimal::ZERO,
                    ..create_request()
                })
                .await,
            "toAmount",
        );
    }
}
