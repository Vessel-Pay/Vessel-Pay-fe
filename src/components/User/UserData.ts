export interface UserData {
  address: string;
  balance: number;
  currency: string;
  currencyIcon: string;
}

/**
 * Fetch user data from blockchain
 * TODO: Replace with actual wallet connection
 */
export async function fetchUserData(): Promise<UserData> {
  // ============================================
  // TODO: Implement actual blockchain data fetching
  // 
  // Example implementation:
  // const provider = new ethers.providers.Web3Provider(window.ethereum);
  // const signer = provider.getSigner();
  // const address = await signer.getAddress();
  // const balance = await getTokenBalance(address, tokenContractAddress);
  // return { address, balance, currency, currencyIcon };
  // ============================================
  // Hardcoded dummy data for development
  return {
    address: '0xb6a1c296d8e4f5a7b3c2d1e0f9a8b7c6d5e4f3a2',
    balance: 0.0500,
    currency: 'USDC',
    currencyIcon: '/icons/usdc.svg',
  };
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
