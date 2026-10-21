use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------- shared enums ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Flow {
    Standard,
    FixedRate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EstimateType {
    Direct,
    Reverse,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TxStatus {
    New,
    Waiting,
    Confirming,
    Exchanging,
    Sending,
    Finished,
    Failed,
    Refunded,
    Verifying,
    #[serde(other)]
    Unknown,
}

impl TxStatus {
    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Finished | Self::Failed | Self::Refunded)
    }
}

// ---------- market info ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Currency {
    pub ticker: String,
    pub name: String,
    pub image: String,
    pub has_external_id: bool,
    pub is_extra_id_supported: bool,
    pub is_fiat: bool,
    pub featured: bool,
    pub is_stable: bool,
    pub supports_fixed_rate: bool,
    pub network: String,
    pub token_contract: Option<String>,
    pub buy: bool,
    pub sell: bool,
    pub legacy_ticker: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailablePair {
    pub from_currency: String,
    pub from_network: String,
    pub to_currency: String,
    pub to_network: String,
    pub flow: FlowSupport,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct FlowSupport {
    pub standard: bool,
    #[serde(rename = "fixed-rate")]
    pub fixed_rate: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinimalExchangeAmount {
    pub from_currency: String,
    pub from_network: String,
    pub to_currency: String,
    pub to_network: String,
    pub flow: Flow,
    pub min_amount: Decimal,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRange {
    pub from_currency: String,
    pub from_network: String,
    pub to_currency: String,
    pub to_network: String,
    pub flow: Flow,
    pub min_amount: Decimal,
    pub max_amount: Option<Decimal>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimatedExchangeAmount {
    pub from_currency: String,
    pub from_network: String,
    pub to_currency: String,
    pub to_network: String,
    pub flow: Flow,
    pub r#type: EstimateType,
    pub rate_id: Option<String>,
    pub valid_until: Option<DateTime<Utc>>,
    pub transaction_speed_forecast: Option<String>,
    pub warning_message: Option<String>,
    pub deposit_fee: Option<Decimal>,
    pub withdrawal_fee: Option<Decimal>,
    pub user_id: Option<Value>,
    pub from_amount: Decimal,
    pub to_amount: Decimal,
}

// ---------- exchanges ----------

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransaction {
    pub from_currency: String,
    pub to_currency: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_network: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_network: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_amount: Option<Decimal>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_amount: Option<Decimal>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_extra_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow: Option<Flow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<EstimateType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionStatus {
    pub id: String,
    pub status: TxStatus,
    pub actions_available: bool,

    pub from_currency: String,
    pub from_network: String,
    pub to_currency: String,
    pub to_network: String,
    pub from_legacy_ticker: String,
    pub to_legacy_ticker: String,

    pub expected_amount_from: Option<Decimal>,
    pub expected_amount_to: Option<Decimal>,
    pub amount_from: Option<Decimal>,
    pub amount_to: Option<Decimal>,
    pub refund_amount: Option<Decimal>,

    pub payin_address: String,
    pub payout_address: String,
    pub payin_extra_id: Option<String>,
    pub payout_extra_id: Option<String>,
    pub refund_address: Option<String>,
    pub refund_extra_id: Option<String>,

    pub payin_hash: Option<String>,
    pub payout_hash: Option<String>,
    pub refund_hash: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deposit_received_at: Option<DateTime<Utc>>,
    pub valid_until: Option<DateTime<Utc>>,

    pub user_id: Option<Value>,
    pub related_exchanges_info: Option<Value>,
    pub repeated_exchanges_info: Option<Value>,
    pub original_exchange_info: Option<Value>,
}

// ---------- private transfers ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateTransferEstimate {
    pub currency: String,
    pub network: String,
    pub from_amount: Decimal,
    pub to_amount: Decimal,
    pub rate_id: String,
    pub valid_until: DateTime<Utc>,
    pub warning_message: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePrivateTransfer {
    pub currency: String,
    pub network: String,
    pub to_amount: Decimal,
    pub address: String,
    pub rate_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_extra_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateTransfer {
    pub id: String,
    pub from_amount: Decimal,
    pub to_amount: Decimal,
    pub payin_address: String,
    pub payout_address: String,
    pub payin_extra_id: Option<String>,
    pub payout_extra_id: Option<String>,
    pub currency: String,
    pub network: String,
    pub refund_address: Option<String>,
    pub refund_extra_id: Option<String>,
}