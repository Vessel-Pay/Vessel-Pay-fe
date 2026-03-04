import { env } from "@/config/env";

const SIGNER_API_URL = env.signerApiUrl;

export interface SignPaymasterRequest {
  payerAddress: string;
  tokenAddress: string;
  validUntil?: number;
  validAfter?: number;
  isActivation?: boolean;
}

export interface SignPaymasterResponse {
  signature: string;
}

export async function getPaymasterSignature(
  params: SignPaymasterRequest
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${SIGNER_API_URL}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payerAddress: params.payerAddress,
        tokenAddress: params.tokenAddress,
        validUntil: params.validUntil ?? Math.floor(Date.now() / 1000) + 3600,
        validAfter: params.validAfter ?? 0,
        isActivation: params.isActivation ?? false,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    throw new Error(
      `Signer API unreachable at ${SIGNER_API_URL}/sign (${message})`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "unknown" }));
    throw new Error(error.message || "Signer error");
  }

  const data: SignPaymasterResponse = await response.json();
  return data.signature;
}

export async function getSignerAddress(): Promise<string | null> {
  try {
    const response = await fetch(`${SIGNER_API_URL}/signer`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.signerAddress as string;
  } catch {
    return null;
  }
}
