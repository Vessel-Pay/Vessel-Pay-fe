export const isNoDataContractError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("returned no data") ||
    normalized.includes("no data (\"0x\")") ||
    normalized.includes("data: \"0x\"")
  );
};

export const isRateLimitError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  );
};
