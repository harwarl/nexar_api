import { Network } from 'src/networks/network.interface';

export interface TokenData {
  code: string;
  name: string;
  networkSlug: string;
  iconUrl?: string;
  providers: {
    [providerName: string]: {
      symbol: string;
      isActive: boolean;
    };
  };
}

export interface TokenResponse {
  id: number;
  token_network: Network; // TODO: change this to network class
  url_icon?: string;
  code: string;
  code_name: string;
  network_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  icon?: string;
  ticker_fixedfloat?: string;
  ticker_changehero?: string;
  ticker_changenow?: string;
  ticker_sideshift?: string;
  ticker_simpleswap?: string;
  ticker_swapuz?: string;
  ticker_thechange?: string;
  ticker_exolix?: string;
  ticker_swaponix?: string;
  ticker_nanswap?: string;
  ticker_changelly?: string;
  coingecko_id?: string;
  coingecko_name?: string;
  coingecko_symbol?: string;
  coingecko_rank?: number;
  last_coingecko_update?: string;
  network: number;
}
