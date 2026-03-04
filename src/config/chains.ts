import type { Address } from "viem";
import { env } from "./env";

export type ChainKey = "base_sepolia" | "etherlink_shadownet";

export type TokenConfig = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  icon: string;
};

export type ChainRuntimeConfig = {
  key: ChainKey;
  chain: {
    id: number;
    name: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    rpcUrls: {
      default: { http: readonly string[] };
    };
    blockExplorers?: {
      default: { name: string; url: string };
    };
    testnet?: boolean;
  };
  rpcUrl: string;
  mainnetRpcUrl?: string;
  blockExplorer: { name: string; url: string };
  nativeCurrency: { name: string; symbol: string; decimals: number };
  entryPointAddress: Address;
  simpleAccountFactory: Address;
  paymasterAddress: Address;
  stableSwapAddress: Address;
  paymentProcessorAddress: Address;
  stablecoinRegistryAddress: Address;
  qrisRegistryAddress: Address;
  activityLookbackBlocks: number;
  tokens: TokenConfig[];
  defaultTokenSymbol: string;
  bundlerUrl: string;
};

const toAddress = (value: string) => value as Address;

export const BASE_SEPOLIA = {
  id: env.base.chainId,
  name: env.base.chainName,
  nativeCurrency: {
    name: env.base.nativeCurrencyName,
    symbol: env.base.nativeCurrencySymbol,
    decimals: env.base.nativeCurrencyDecimals,
  },
  rpcUrls: {
    default: { http: [env.base.rpcUrl] },
  },
  blockExplorers: {
    default: { name: env.base.blockExplorerName, url: env.base.blockExplorerUrl },
  },
  testnet: true,
} as const;

export const ETHERLINK_SHADOWNET = {
  id: env.etherlink.chainId,
  name: env.etherlink.chainName,
  nativeCurrency: {
    name: env.etherlink.nativeCurrencyName,
    symbol: env.etherlink.nativeCurrencySymbol,
    decimals: env.etherlink.nativeCurrencyDecimals,
  },
  rpcUrls: {
    default: { http: [env.etherlink.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: env.etherlink.blockExplorerName,
      url: env.etherlink.blockExplorerUrl,
    },
  },
  testnet: true,
} as const;

const buildBundlerUrl = (chainId: number) =>
  `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${env.pimlicoApiKey}`;

export const CHAIN_CONFIGS: Record<ChainKey, ChainRuntimeConfig> = {
  base_sepolia: {
    key: "base_sepolia",
    chain: BASE_SEPOLIA,
    rpcUrl: env.base.rpcUrl,
    mainnetRpcUrl: env.base.mainnetRpcUrl,
    blockExplorer: {
      name: env.base.blockExplorerName,
      url: env.base.blockExplorerUrl,
    },
    nativeCurrency: {
      name: env.base.nativeCurrencyName,
      symbol: env.base.nativeCurrencySymbol,
      decimals: env.base.nativeCurrencyDecimals,
    },
    entryPointAddress: toAddress(env.base.entryPointAddress),
    simpleAccountFactory: toAddress(env.base.simpleAccountFactory),
    paymasterAddress: toAddress(env.base.paymasterAddress),
    stableSwapAddress: toAddress(env.base.stableSwapAddress),
    paymentProcessorAddress: toAddress(env.base.paymentProcessorAddress),
    stablecoinRegistryAddress: toAddress(env.base.stablecoinRegistryAddress),
    qrisRegistryAddress: toAddress(env.base.qrisRegistryAddress),
    activityLookbackBlocks: env.base.activityLookbackBlocks,
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: toAddress(env.base.tokenUsdcAddress),
        decimals: env.base.tokenUsdcDecimals,
        icon: "/icons/usdc.svg",
      },
      {
        symbol: "USDS",
        name: "Sky Dollar",
        address: toAddress(env.base.tokenUsdsAddress),
        decimals: env.base.tokenUsdsDecimals,
        icon: "/icons/sky-dollar.svg",
      },
      {
        symbol: "EURC",
        name: "Euro Coin",
        address: toAddress(env.base.tokenEurcAddress),
        decimals: env.base.tokenEurcDecimals,
        icon: "/icons/eurc.svg",
      },
      {
        symbol: "BRZ",
        name: "Brazilian Digital",
        address: toAddress(env.base.tokenBrzAddress),
        decimals: env.base.tokenBrzDecimals,
        icon: "/icons/brazillian.svg",
      },
      {
        symbol: "AUDD",
        name: "AUDD",
        address: toAddress(env.base.tokenAuddAddress),
        decimals: env.base.tokenAuddDecimals,
        icon: "/icons/audd.svg",
      },
      {
        symbol: "CADC",
        name: "CAD Coin",
        address: toAddress(env.base.tokenCadcAddress),
        decimals: env.base.tokenCadcDecimals,
        icon: "/icons/cad.svg",
      },
      {
        symbol: "ZCHF",
        name: "Frankencoin",
        address: toAddress(env.base.tokenZchfAddress),
        decimals: env.base.tokenZchfDecimals,
        icon: "/icons/frankencoin.svg",
      },
      {
        symbol: "TGBP",
        name: "Tokenised GBP",
        address: toAddress(env.base.tokenTgbpAddress),
        decimals: env.base.tokenTgbpDecimals,
        icon: "/icons/tokenised.svg",
      },
      {
        symbol: "IDRX",
        name: "IDRX",
        address: toAddress(env.base.tokenIdrxAddress),
        decimals: env.base.tokenIdrxDecimals,
        icon: "/icons/idrx.svg",
      },
    ],
    defaultTokenSymbol: env.defaultTokenSymbol,
    bundlerUrl: buildBundlerUrl(env.base.chainId),
  },
  etherlink_shadownet: {
    key: "etherlink_shadownet",
    chain: ETHERLINK_SHADOWNET,
    rpcUrl: env.etherlink.rpcUrl,
    mainnetRpcUrl: env.etherlink.mainnetRpcUrl,
    blockExplorer: {
      name: env.etherlink.blockExplorerName,
      url: env.etherlink.blockExplorerUrl,
    },
    nativeCurrency: {
      name: env.etherlink.nativeCurrencyName,
      symbol: env.etherlink.nativeCurrencySymbol,
      decimals: env.etherlink.nativeCurrencyDecimals,
    },
    entryPointAddress: toAddress(env.etherlink.entryPointAddress),
    simpleAccountFactory: toAddress(env.etherlink.simpleAccountFactory),
    paymasterAddress: toAddress(env.etherlink.paymasterAddress),
    stableSwapAddress: toAddress(env.etherlink.stableSwapAddress),
    paymentProcessorAddress: toAddress(env.etherlink.paymentProcessorAddress),
    stablecoinRegistryAddress: toAddress(env.etherlink.stablecoinRegistryAddress),
    qrisRegistryAddress: toAddress(env.etherlink.qrisRegistryAddress),
    activityLookbackBlocks: env.etherlink.activityLookbackBlocks,
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: toAddress(env.etherlink.tokenUsdcAddress),
        decimals: env.etherlink.tokenUsdcDecimals,
        icon: "/icons/usdc.svg",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: toAddress(env.etherlink.tokenUsdtAddress),
        decimals: env.etherlink.tokenUsdtDecimals,
        icon: "/icons/usdt.svg",
      },
      {
        symbol: "IDRX",
        name: "IDRX",
        address: toAddress(env.etherlink.tokenIdrxAddress),
        decimals: env.etherlink.tokenIdrxDecimals,
        icon: "/icons/idrx.svg",
      },
    ],
    defaultTokenSymbol: env.defaultTokenSymbol,
    bundlerUrl: buildBundlerUrl(env.etherlink.chainId),
  },
};

const parseChainKey = (value: string | undefined): ChainKey | undefined => {
  if (!value) return undefined;
  const raw = value.trim().toLowerCase();
  if (raw === "base" || raw === "base_sepolia" || raw === "84532") {
    return "base_sepolia";
  }
  if (
    raw === "etherlink" ||
    raw === "etherlink_shadownet" ||
    raw === "shadownet" ||
    raw === "127823"
  ) {
    return "etherlink_shadownet";
  }
  return undefined;
};

export const DEFAULT_CHAIN_KEY: ChainKey =
  parseChainKey(env.defaultChain) ?? "etherlink_shadownet";

export const CHAIN_KEYS = Object.keys(CHAIN_CONFIGS) as ChainKey[];

export const getChainConfig = (key: ChainKey) => CHAIN_CONFIGS[key];

export const getChainConfigById = (id: number): ChainRuntimeConfig | undefined =>
  Object.values(CHAIN_CONFIGS).find((config) => config.chain.id === id);
