import type { ChainRuntimeConfig } from "@/config/chains";

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  chainId: number;
  tokenAddress: string;
  decimals: number;
}

export const buildCurrencies = (config: ChainRuntimeConfig): Currency[] =>
  config.tokens.map((token) => ({
    id: token.symbol.toLowerCase(),
    name: token.name,
    symbol: token.symbol,
    icon: token.icon,
    chainId: config.chain.id,
    tokenAddress: token.address,
    decimals: token.decimals,
  }));
