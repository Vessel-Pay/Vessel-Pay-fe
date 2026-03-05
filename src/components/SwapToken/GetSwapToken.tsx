import { Currency } from '@/components/Currency';

export interface SwapResult {
  convertedAmount: number;
  rate: number;
  fee: number;
}

/**
 * Get swap conversion result
 * TODO: Replace hardcoded values with actual API call to get real-time rates
 */
export function getSwapResult(
  fromCurrency: Currency,
  toCurrency: Currency,
  amount: number
): SwapResult {
  // ============================================
  // TODO: Implement actual conversion logic here
  // This should call an API or smart contract to get real-time rates
  // ============================================
  
  // Hardcoded rates (1 USD = X currency)
  const usdRates: Record<string, number> = {
    usdc: 1,
    usdt: 1,
    idrx: 15800,    // 1 USD = 15,800 IDR
    jpyc: 150,      // 1 USD = 150 JPY
    euroc: 0.92,    // 1 USD = 0.92 EUR
    mxnt: 17.5,     // 1 USD = 17.5 MXN
    chnt: 7.2,      // 1 USD = 7.2 CNY
  };

  // Get rates for both currencies
  const fromRate = usdRates[fromCurrency.id] || 1;
  const toRate = usdRates[toCurrency.id] || 1;

  // ============================================
  // TODO: Calculate actual rate from API/oracle
  // rate = how many toCurrency per 1 fromCurrency
  // ============================================
  const rate = toRate / fromRate;

  // ============================================
  // TODO: Get actual gas fee from network and convert to fromCurrency
  // This should be fetched from the blockchain
  // ============================================
  const ethGasFee = 0.001; // Hardcoded ETH gas fee
  const ethToUsd = 3500;   // Hardcoded ETH price in USD
  const gasFeeInUsd = ethGasFee * ethToUsd;
  const fee = gasFeeInUsd * fromRate; // Fee in fromCurrency

  // Calculate converted amount
  const convertedAmount = amount * rate;
  return {
    convertedAmount,
    rate,
    fee,
  };
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  if (num === 0) return '0';
  
  // Handle decimals
  if (num < 1) {
    return num.toFixed(6);
  }
  
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 6,
  });
}
