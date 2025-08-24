export interface Network {
  id: number;
  slug: string;
  name: string;
  aliases: string[];
  ticker_fixedfloat?: string | null;
  ticker_changehero?: string | null;
  ticker_changenow?: string | null;
  ticker_sideshift?: string | null;
  ticker_simpleswap?: string | null;
  ticker_swapuz?: string | null;
  ticker_thechange?: string | null;
  ticker_exolix?: string | null;
  ticker_swaponix?: string | null;
  ticker_nanswap?: string | null;
  ticker_changelly?: string | null;
}

export interface NetworkMapping {
  [slug: string]: Network;
}
