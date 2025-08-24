export interface TokenProvider {
  readonly name: string;
  fetchSupportedTokens(): Promise<ProviderToken[]>;
}

export interface ProviderToken {
  symbol: string;
  network: string;
  name?: string;
  isActive?: boolean;
  iconUrl?: string;
  // Add other provider specific fields
}
