import { encodePacked, type Address } from "viem";

export interface PaymasterDataParams {
  tokenAddress: Address;
  payerAddress: Address;
  validUntil: number;
  validAfter: number;
  hasPermit: boolean;
  isActivation: boolean;
  permitDeadline?: bigint;
  permitV?: number;
  permitR?: `0x${string}`;
  permitS?: `0x${string}`;
  signature: `0x${string}`;
}

export function buildPaymasterData(params: PaymasterDataParams): `0x${string}` {
  const {
    tokenAddress,
    payerAddress,
    validUntil,
    validAfter,
    hasPermit,
    isActivation,
    permitDeadline,
    permitV,
    permitR,
    permitS,
    signature,
  } = params;

  if (hasPermit) {
    if (!permitDeadline || permitV === undefined || !permitR || !permitS) {
      throw new Error("Permit details are required when hasPermit is true");
    }

    return encodePacked(
      [
        "address",
        "address",
        "uint48",
        "uint48",
        "uint8",
        "uint8",
        "uint256",
        "uint8",
        "bytes32",
        "bytes32",
        "bytes",
      ],
      [
        tokenAddress,
        payerAddress,
        validUntil,
        validAfter,
        1,
        isActivation ? 1 : 0,
        permitDeadline,
        permitV,
        permitR,
        permitS,
        signature,
      ]
    );
  }

  return encodePacked(
    ["address", "address", "uint48", "uint48", "uint8", "uint8", "bytes"],
    [tokenAddress, payerAddress, validUntil, validAfter, 0, isActivation ? 1 : 0, signature]
  );
}

export interface FullPaymasterDataParams extends PaymasterDataParams {
  paymasterAddress: Address;
  paymasterVerificationGasLimit?: bigint;
  paymasterPostOpGasLimit?: bigint;
}

export function buildPaymasterAndData(
  params: FullPaymasterDataParams
): `0x${string}` {
  const {
    paymasterAddress,
    paymasterVerificationGasLimit = BigInt(100_000),
    paymasterPostOpGasLimit = BigInt(50_000),
    ...custom
  } = params;

  const customData = buildPaymasterData(custom);

  return encodePacked(
    ["address", "uint128", "uint128", "bytes"],
    [
      paymasterAddress,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
      customData,
    ]
  );
}
