export interface TokenProvider {
  readonly name: string;
  fetchSupportedTokens(): Promise<ProviderToken[]>;
  fetchSupportedNetworks?(): Promise<ProviderNetwork[]>;
}

export interface ProviderToken {
  symbol: string;
  network: string;
  name?: string;
  alias?: string;
  isActive?: boolean;
  iconUrl?: string;
  // Add other provider specific fields
}

export interface ProviderNetwork {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
  features?: string[];
}
