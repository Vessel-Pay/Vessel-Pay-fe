import { env } from "@/config/env";

function getApiUrl(): string {
  if (!env.signerApiUrl) {
    throw new Error("NEXT_PUBLIC_SIGNER_API_URL is not set");
  }
  return env.signerApiUrl;
}

export interface SwapQuoteResponse {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  fee: string;
  totalUserPays: string;
}

export async function fetchSwapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  chainId?: number;
}): Promise<SwapQuoteResponse> {
  const apiUrl = getApiUrl();
  const chainQuery = params.chainId ? `&chainId=${params.chainId}` : "";
  const url = `${apiUrl}/swap/quote?tokenIn=${params.tokenIn}&tokenOut=${params.tokenOut
    }&amountIn=${params.amountIn.toString()}${chainQuery}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "quote failed" }));
    throw new Error(err.message || "quote failed");
  }
  return (await res.json()) as SwapQuoteResponse;
}

export async function buildSwapCalldata(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  chainId?: number;
  autoRoute?: boolean;
}): Promise<{ to: string; data: string; value: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/swap/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn.toString(),
      minAmountOut: params.minAmountOut.toString(),
      ...(params.chainId ? { chainId: params.chainId } : {}),
      ...(params.autoRoute !== undefined ? { autoRoute: params.autoRoute } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "build failed" }));
    throw new Error(err.message || "build failed");
  }

  const data = await res.json();
  return { to: data.to, data: data.data, value: data.value };
}
