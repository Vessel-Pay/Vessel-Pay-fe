const requireEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const optionalEnv = (value: string | undefined) => {
  if (!value || value.trim() === "") return undefined;
  return value;
};

const parseNumber = (value: string, name: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
};

export const env = {
  pimlicoApiKey: requireEnv(
    process.env.NEXT_PUBLIC_PIMLICO_API_KEY,
    "NEXT_PUBLIC_PIMLICO_API_KEY",
  ),
  signerApiUrl: requireEnv(
    process.env.NEXT_PUBLIC_SIGNER_API_URL,
    "NEXT_PUBLIC_SIGNER_API_URL",
  ),
  defaultTokenSymbol: requireEnv(
    process.env.NEXT_PUBLIC_DEFAULT_TOKEN_SYMBOL,
    "NEXT_PUBLIC_DEFAULT_TOKEN_SYMBOL",
  ),
  defaultChain: optionalEnv(process.env.NEXT_PUBLIC_DEFAULT_CHAIN),
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  base: {
    chainId: parseNumber(
      requireEnv(process.env.NEXT_PUBLIC_CHAIN_ID, "NEXT_PUBLIC_CHAIN_ID"),
      "NEXT_PUBLIC_CHAIN_ID",
    ),
    chainName: requireEnv(
      process.env.NEXT_PUBLIC_CHAIN_NAME,
      "NEXT_PUBLIC_CHAIN_NAME",
    ),
    rpcUrl: requireEnv(process.env.NEXT_PUBLIC_RPC_URL, "NEXT_PUBLIC_RPC_URL"),
    mainnetRpcUrl: optionalEnv(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
    blockExplorerName: requireEnv(
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME,
      "NEXT_PUBLIC_BLOCK_EXPLORER_NAME",
    ),
    blockExplorerUrl: requireEnv(
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL,
      "NEXT_PUBLIC_BLOCK_EXPLORER_URL",
    ),
    nativeCurrencyName: requireEnv(
      process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME,
      "NEXT_PUBLIC_NATIVE_CURRENCY_NAME",
    ),
    nativeCurrencySymbol: requireEnv(
      process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL,
      "NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL",
    ),
    nativeCurrencyDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS,
        "NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS",
      ),
      "NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS",
    ),
    entryPointAddress: requireEnv(
      process.env.NEXT_PUBLIC_ENTRY_POINT_ADDRESS,
      "NEXT_PUBLIC_ENTRY_POINT_ADDRESS",
    ),
    simpleAccountFactory: requireEnv(
      process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY,
      "NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY",
    ),
    paymasterAddress: requireEnv(
      process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
      "NEXT_PUBLIC_PAYMASTER_ADDRESS",
    ),
    stableSwapAddress: requireEnv(
      process.env.NEXT_PUBLIC_STABLE_SWAP_ADDRESS,
      "NEXT_PUBLIC_STABLE_SWAP_ADDRESS",
    ),
    paymentProcessorAddress: requireEnv(
      process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS,
      "NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS",
    ),
    stablecoinRegistryAddress: requireEnv(
      process.env.NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS,
      "NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS",
    ),
    qrisRegistryAddress: requireEnv(
      process.env.NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS,
      "NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS",
    ),
    tokenUsdcAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_USDC_ADDRESS,
      "NEXT_PUBLIC_TOKEN_USDC_ADDRESS",
    ),
    tokenUsdcDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_USDC_DECIMALS,
        "NEXT_PUBLIC_TOKEN_USDC_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_USDC_DECIMALS",
    ),
    tokenUsdsAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_USDS_ADDRESS,
      "NEXT_PUBLIC_TOKEN_USDS_ADDRESS",
    ),
    tokenUsdsDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_USDS_DECIMALS,
        "NEXT_PUBLIC_TOKEN_USDS_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_USDS_DECIMALS",
    ),
    tokenEurcAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_EURC_ADDRESS,
      "NEXT_PUBLIC_TOKEN_EURC_ADDRESS",
    ),
    tokenEurcDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_EURC_DECIMALS,
        "NEXT_PUBLIC_TOKEN_EURC_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_EURC_DECIMALS",
    ),
    tokenBrzAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_BRZ_ADDRESS,
      "NEXT_PUBLIC_TOKEN_BRZ_ADDRESS",
    ),
    tokenBrzDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_BRZ_DECIMALS,
        "NEXT_PUBLIC_TOKEN_BRZ_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_BRZ_DECIMALS",
    ),
    tokenAuddAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_AUDD_ADDRESS,
      "NEXT_PUBLIC_TOKEN_AUDD_ADDRESS",
    ),
    tokenAuddDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_AUDD_DECIMALS,
        "NEXT_PUBLIC_TOKEN_AUDD_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_AUDD_DECIMALS",
    ),
    tokenCadcAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_CADC_ADDRESS,
      "NEXT_PUBLIC_TOKEN_CADC_ADDRESS",
    ),
    tokenCadcDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_CADC_DECIMALS,
        "NEXT_PUBLIC_TOKEN_CADC_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_CADC_DECIMALS",
    ),
    tokenZchfAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_ZCHF_ADDRESS,
      "NEXT_PUBLIC_TOKEN_ZCHF_ADDRESS",
    ),
    tokenZchfDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_ZCHF_DECIMALS,
        "NEXT_PUBLIC_TOKEN_ZCHF_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_ZCHF_DECIMALS",
    ),
    tokenTgbpAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_TGBP_ADDRESS,
      "NEXT_PUBLIC_TOKEN_TGBP_ADDRESS",
    ),
    tokenTgbpDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_TGBP_DECIMALS,
        "NEXT_PUBLIC_TOKEN_TGBP_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_TGBP_DECIMALS",
    ),
    tokenIdrxAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_IDRX_ADDRESS,
      "NEXT_PUBLIC_TOKEN_IDRX_ADDRESS",
    ),
    tokenIdrxDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_IDRX_DECIMALS,
        "NEXT_PUBLIC_TOKEN_IDRX_DECIMALS",
      ),
      "NEXT_PUBLIC_TOKEN_IDRX_DECIMALS",
    ),
    activityLookbackBlocks: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS,
        "NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS",
      ),
      "NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS",
    ),
  },
  etherlink: {
    chainId: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_CHAIN_ID_ETHERLINK,
        "NEXT_PUBLIC_CHAIN_ID_ETHERLINK",
      ),
      "NEXT_PUBLIC_CHAIN_ID_ETHERLINK",
    ),
    chainName: requireEnv(
      process.env.NEXT_PUBLIC_CHAIN_NAME_ETHERLINK,
      "NEXT_PUBLIC_CHAIN_NAME_ETHERLINK",
    ),
    rpcUrl: requireEnv(
      process.env.NEXT_PUBLIC_RPC_URL_ETHERLINK,
      "NEXT_PUBLIC_RPC_URL_ETHERLINK",
    ),
    mainnetRpcUrl: optionalEnv(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL_ETHERLINK,
    ),
    blockExplorerName: requireEnv(
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME_ETHERLINK,
      "NEXT_PUBLIC_BLOCK_EXPLORER_NAME_ETHERLINK",
    ),
    blockExplorerUrl: requireEnv(
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_ETHERLINK,
      "NEXT_PUBLIC_BLOCK_EXPLORER_URL_ETHERLINK",
    ),
    nativeCurrencyName: requireEnv(
      process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME_ETHERLINK,
      "NEXT_PUBLIC_NATIVE_CURRENCY_NAME_ETHERLINK",
    ),
    nativeCurrencySymbol: requireEnv(
      process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL_ETHERLINK,
      "NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL_ETHERLINK",
    ),
    nativeCurrencyDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS_ETHERLINK,
        "NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS_ETHERLINK",
      ),
      "NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS_ETHERLINK",
    ),
    entryPointAddress: requireEnv(
      process.env.NEXT_PUBLIC_ENTRY_POINT_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_ENTRY_POINT_ADDRESS_ETHERLINK",
    ),
    simpleAccountFactory: requireEnv(
      process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ETHERLINK,
      "NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ETHERLINK",
    ),
    paymasterAddress: requireEnv(
      process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_PAYMASTER_ADDRESS_ETHERLINK",
    ),
    stableSwapAddress: requireEnv(
      process.env.NEXT_PUBLIC_STABLE_SWAP_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_STABLE_SWAP_ADDRESS_ETHERLINK",
    ),
    paymentProcessorAddress: requireEnv(
      process.env.NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_ETHERLINK",
    ),
    stablecoinRegistryAddress: requireEnv(
      process.env.NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS_ETHERLINK",
    ),
    qrisRegistryAddress: requireEnv(
      process.env.NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS_ETHERLINK",
    ),
    tokenUsdtAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_USDT_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_TOKEN_USDT_ADDRESS_ETHERLINK",
    ),
    tokenUsdtDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_USDT_DECIMALS_ETHERLINK,
        "NEXT_PUBLIC_TOKEN_USDT_DECIMALS_ETHERLINK",
      ),
      "NEXT_PUBLIC_TOKEN_USDT_DECIMALS_ETHERLINK",
    ),
    tokenUsdcAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_USDC_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_TOKEN_USDC_ADDRESS_ETHERLINK",
    ),
    tokenUsdcDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_USDC_DECIMALS_ETHERLINK,
        "NEXT_PUBLIC_TOKEN_USDC_DECIMALS_ETHERLINK",
      ),
      "NEXT_PUBLIC_TOKEN_USDC_DECIMALS_ETHERLINK",
    ),
    tokenIdrxAddress: requireEnv(
      process.env.NEXT_PUBLIC_TOKEN_IDRX_ADDRESS_ETHERLINK,
      "NEXT_PUBLIC_TOKEN_IDRX_ADDRESS_ETHERLINK",
    ),
    tokenIdrxDecimals: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_TOKEN_IDRX_DECIMALS_ETHERLINK,
        "NEXT_PUBLIC_TOKEN_IDRX_DECIMALS_ETHERLINK",
      ),
      "NEXT_PUBLIC_TOKEN_IDRX_DECIMALS_ETHERLINK",
    ),
    activityLookbackBlocks: parseNumber(
      requireEnv(
        process.env.NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS_ETHERLINK,
        "NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS_ETHERLINK",
      ),
      "NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS_ETHERLINK",
    ),
  },
};
