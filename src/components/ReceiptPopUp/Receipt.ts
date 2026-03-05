export type ReceiptType = "send" | "receive" | "swap";
export type ReceiptStatus = "success" | "failed";

export interface ReceiptData {
  id: string;
  type: ReceiptType;
  status: ReceiptStatus;
  timestamp: Date;
  // Transaction details
  amount: number;
  currency: string;
  currencyIcon: string;
  // For cross-token send: sender pays with different token
  senderCurrency?: string;
  senderCurrencyIcon?: string;
  // Address info
  fromAddress?: string;
  toAddress?: string;
  // For swap
  swapToAmount?: number;
  swapToCurrency?: string;
  swapToCurrencyIcon?: string;
  // Transaction hash
  txHash?: string;
  // Error message for failed transactions
  errorMessage?: string;
  // For multi-token payments: breakdown of tokens used
  tokenBreakdown?: {
    symbol: string;
    amount: number;
    icon: string;
  }[];
}

/**
 * Fetch receipt data from blockchain
 * TODO: Replace with actual smart contract call
 */
export async function fetchReceiptFromBlockchain(
  txHash: string,
): Promise<ReceiptData> {
  // ============================================
  // TODO: Implement actual blockchain receipt fetching
  //
  // Example implementation:
  // const provider = new ethers.providers.Web3Provider(window.ethereum);
  // const receipt = await provider.getTransactionReceipt(txHash);
  // const tx = await provider.getTransaction(txHash);
  // return parseTransactionToReceiptData(receipt, tx);
  // ============================================
  // Hardcoded dummy data for development
  return {
    id: "1",
    type: "receive",
    status: "success",
    timestamp: new Date(),
    amount: 0.000001,
    currency: "USDC",
    currencyIcon: "/icons/usdc.svg",
    fromAddress: "0xb6...c296",
    toAddress: "0x49...ba4c",
    txHash: txHash,
  };
}

/**
 * Format date for receipt
 */
export function formatReceiptDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format time for receipt
 */
export function formatReceiptTime(date: Date): string {
  return (
    date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
