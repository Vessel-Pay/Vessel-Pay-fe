import { env } from "@/config/env";

const API_URL = env.signerApiUrl;

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
  const chainQuery = params.chainId ? `&chainId=${params.chainId}` : "";
  const url = `${API_URL}/swap/quote?tokenIn=${params.tokenIn}&tokenOut=${
    params.tokenOut
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
}): Promise<{ to: string; data: string; value: string }> {
  const res = await fetch(`${API_URL}/swap/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn.toString(),
      minAmountOut: params.minAmountOut.toString(),
      ...(params.chainId ? { chainId: params.chainId } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "build failed" }));
    throw new Error(err.message || "build failed");
  }

  const data = await res.json();
  return { to: data.to, data: data.data, value: data.value };
}
