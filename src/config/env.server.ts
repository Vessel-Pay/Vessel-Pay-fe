import "server-only";

const requireEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

export const idrxEnv = {
  apiKey: requireEnv(process.env.IDRX_API_KEY, "IDRX_API_KEY"),
  secretKey: requireEnv(process.env.IDRX_SECRET_KEY, "IDRX_SECRET_KEY"),
  baseUrl: requireEnv(process.env.IDRX_BASE_URL, "IDRX_BASE_URL"),
  networkChainId: requireEnv(
    process.env.IDRX_NETWORK_CHAIN_ID,
    "IDRX_NETWORK_CHAIN_ID",
  ),
  networkChainIdEtherlink: requireEnv(
    process.env.IDRX_NETWORK_CHAIN_ID_ETHERLINK,
    "IDRX_NETWORK_CHAIN_ID_ETHERLINK",
  ),
};
