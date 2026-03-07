import { env } from "@/config/env";

function getSignerApiUrl(): string {
  if (!env.signerApiUrl) {
    throw new Error("NEXT_PUBLIC_SIGNER_API_URL is not set");
  }
  return env.signerApiUrl;
}

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
  const signerApiUrl = getSignerApiUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.edgeSignApiKey) {
    headers["x-api-key"] = env.edgeSignApiKey;
  }

  let response: Response;
  try {
    response = await fetch(`${signerApiUrl}/sign`, {
      method: "POST",
      headers,
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
      `Signer API unreachable at ${signerApiUrl}/sign (${message})`
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
    const signerApiUrl = getSignerApiUrl();
    const response = await fetch(`${signerApiUrl}/signer`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.signerAddress as string;
  } catch {
    return null;
  }
}
