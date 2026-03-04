import { env } from "./env";
import type { ChainKey, ChainRuntimeConfig, TokenConfig } from "./chains";
import { CHAIN_CONFIGS, DEFAULT_CHAIN_KEY, getChainConfig } from "./chains";

export const DEFAULT_TOKEN_SYMBOL = env.defaultTokenSymbol;
export const SIGNER_API_URL = env.signerApiUrl;
export const PIMLICO_API_KEY = env.pimlicoApiKey;
export const DEFAULT_CHAIN = DEFAULT_CHAIN_KEY;

export const getTokens = (chainKey: ChainKey): TokenConfig[] =>
  getChainConfig(chainKey).tokens;

export const getChainRuntimeConfig = (
  chainKey: ChainKey,
): ChainRuntimeConfig => CHAIN_CONFIGS[chainKey];
