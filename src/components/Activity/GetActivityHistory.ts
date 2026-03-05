import { ActivityData, GroupedActivities } from "./types";
import {
  createPublicClient,
  http,
  parseAbiItem,
  formatUnits,
  type Address,
} from "viem";
import type { ChainRuntimeConfig, TokenConfig } from "@/config/chains";

const transferEventAbi = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const paymentCompletedEventAbi = parseAbiItem(
  "event PaymentCompleted(bytes32 indexed nonce, address indexed recipient, address indexed payer, address requestedToken, address payToken, uint256 requestedAmount, uint256 paidAmount)"
);

const MAX_ACTIVITIES = 10;
const MAX_BLOCK_RANGE = 20000n;
const MIN_BLOCK_RANGE = 2000n;
const MAX_CHUNKS = 20;
const BLOCKSCOUT_LIMIT = 25;

type PublicClient = ReturnType<typeof createPublicClient>;
type LogWithArgs = Awaited<ReturnType<PublicClient["getLogs"]>>[number] & {
  args?: Record<string, unknown> | readonly unknown[];
};

type TransferLog = LogWithArgs;

type TokenTransferLog = {
  log: TransferLog;
  token: TokenConfig;
  direction: "send" | "receive";
};

type PaymentLog = {
  log: LogWithArgs;
  role: "payer" | "recipient";
};

type GetLogsParams = Parameters<PublicClient["getLogs"]>[0];

const getLogsSafe = async (
  publicClient: PublicClient,
  params: Omit<GetLogsParams, "fromBlock" | "toBlock">,
  fromBlock: bigint,
  toBlock: bigint
): Promise<Awaited<ReturnType<PublicClient["getLogs"]>>> => {
  try {
    return await publicClient.getLogs({ ...params, fromBlock, toBlock } as any);
  } catch (err) {
    if (toBlock <= fromBlock) {
      return [];
    }
    const range = toBlock - fromBlock;
    if (range <= MIN_BLOCK_RANGE) {
      console.warn("getLogs failed for small range:", {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        error: err,
      });
      return [];
    }
    const mid = fromBlock + range / 2n;
    const [left, right] = await Promise.all([
      getLogsSafe(publicClient, params, fromBlock, mid),
      getLogsSafe(publicClient, params, mid + 1n, toBlock),
    ]);
    return [...left, ...right];
  }
};

const getTransferArgs = (
  log: LogWithArgs
): { from?: Address; to?: Address; value?: bigint } | undefined => {
  if (!log.args || Array.isArray(log.args)) return undefined;
  return log.args as {
    from?: Address;
    to?: Address;
    value?: bigint;
  };
};

const getPaymentArgs = (
  log: LogWithArgs
):
  | {
      recipient: Address;
      payer: Address;
      requestedToken: Address;
      payToken: Address;
      requestedAmount: bigint;
      paidAmount: bigint;
    }
  | undefined => {
  if (!log.args || Array.isArray(log.args)) return undefined;
  return log.args as {
    recipient: Address;
    payer: Address;
    requestedToken: Address;
    payToken: Address;
    requestedAmount: bigint;
    paidAmount: bigint;
  };
};

const normalizeExplorerApiUrl = (url: string) =>
  `${url.replace(/\/$/, "")}/api`;

const fetchBlockscoutTokenTransfers = async (
  walletAddress: string,
  config: ChainRuntimeConfig
): Promise<ActivityData[]> => {
  if (!config.blockExplorer?.url) return [];
  const apiUrl = normalizeExplorerApiUrl(config.blockExplorer.url);
  const address = walletAddress.toLowerCase();
  const tokenMap = new Map(
    config.tokens.map((token) => [token.address.toLowerCase(), token])
  );
  const excludedAddresses = new Set(
    [
      config.paymasterAddress,
      config.stableSwapAddress,
      config.paymentProcessorAddress,
    ].map((addr) => addr.toLowerCase())
  );

  const url = `${apiUrl}?module=account&action=tokentx&address=${address}&page=1&offset=${BLOCKSCOUT_LIMIT}&sort=desc`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Blockscout tokentx failed:", res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.result)) {
      return [];
    }

    const activities: ActivityData[] = [];

    for (const tx of data.result) {
      const contractAddress = String(tx.contractAddress || tx.tokenAddress || "")
        .toLowerCase();
      const token = tokenMap.get(contractAddress);
      if (!token) continue;

      const from = String(tx.from || "").toLowerCase();
      const to = String(tx.to || "").toLowerCase();
      const direction =
        from === address ? "send" : to === address ? "receive" : null;
      if (!direction) continue;
      const counterparty = direction === "send" ? to : from;
      if (excludedAddresses.has(counterparty)) {
        continue;
      }

      const valueRaw = tx.value ? BigInt(tx.value) : 0n;
      const amount = parseFloat(formatUnits(valueRaw, token.decimals));
      const timestamp = new Date(Number(tx.timeStamp || 0) * 1000);
      const txHash = tx.hash || tx.transactionHash;
      const id = `${txHash}-${contractAddress}-${direction}`;

      activities.push({
        id,
        type: direction,
        status: "confirmed",
        timestamp,
        amount,
        currency: token.symbol,
        currencyIcon: token.icon,
        txHash,
        fromAddress: tx.from,
        toAddress: tx.to,
      });

      if (activities.length >= MAX_ACTIVITIES) break;
    }

    return activities;
  } catch (err) {
    console.warn("Blockscout tokentx fetch error:", err);
    return [];
  }
};

/**
 * Fetch activity history from blockchain
 */
export async function fetchActivityHistory(
  walletAddress: string,
  config: ChainRuntimeConfig
): Promise<ActivityData[]> {
  if (!walletAddress || walletAddress === "0x1234...5678") {
    return [];
  }

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const tokens = config.tokens;
  const tokenInfoMap = new Map(
    tokens.map((token) => [token.address.toLowerCase(), token])
  );
  const MAX_LOOKBACK_BLOCKS = BigInt(config.activityLookbackBlocks);

  const address = walletAddress.toLowerCase() as Address;
  const stableSwapAddress = config.stableSwapAddress.toLowerCase();
  const paymentProcessorAddress =
    config.paymentProcessorAddress.toLowerCase();
  const paymasterAddress = config.paymasterAddress.toLowerCase();

  const activities: ActivityData[] = [];
  const blockTimestampCache = new Map<bigint, Date>();

  const getBlockDate = async (blockNumber: bigint) => {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    const block = await publicClient.getBlock({ blockNumber });
    const date = new Date(Number(block.timestamp) * 1000);
    blockTimestampCache.set(blockNumber, date);
    return date;
  };

  const getTokenByAddress = (tokenAddress: string) =>
    tokenInfoMap.get(tokenAddress.toLowerCase());

  const buildActivitiesFromLogs = async (
    transferLogs: TokenTransferLog[],
    paymentLogs: PaymentLog[]
  ): Promise<ActivityData[]> => {
    const chunkActivities: ActivityData[] = [];
    const swapLogIds = new Set<string>();

    const swapCandidates = new Map<
      string,
      { out?: TokenTransferLog; in?: TokenTransferLog }
    >();

    for (const entry of transferLogs) {
      const args = getTransferArgs(entry.log);
      const from = (args?.from as string | undefined)?.toLowerCase();
      const to = (args?.to as string | undefined)?.toLowerCase();
      const txHash = entry.log.transactionHash as string | undefined;
      if (!txHash) continue;

      if (entry.direction === "send" && to === stableSwapAddress) {
        const existing = swapCandidates.get(txHash) || {};
        existing.out = entry;
        swapCandidates.set(txHash, existing);
      }

      if (entry.direction === "receive" && from === stableSwapAddress) {
        const existing = swapCandidates.get(txHash) || {};
        existing.in = entry;
        swapCandidates.set(txHash, existing);
      }
    }

    const processedLogIds = new Set<string>();

    for (const [txHash, pair] of swapCandidates.entries()) {
      if (!pair.out || !pair.in) continue;
      if (pair.out.log.blockNumber == null || pair.in.log.blockNumber == null) {
        continue;
      }

      const outLogId = `${pair.out.log.transactionHash}-${pair.out.log.logIndex}`;
      const inLogId = `${pair.in.log.transactionHash}-${pair.in.log.logIndex}`;
      swapLogIds.add(outLogId);
      swapLogIds.add(inLogId);

      const timestamp = await getBlockDate(pair.out.log.blockNumber);
      const outArgs = getTransferArgs(pair.out.log);
      const inArgs = getTransferArgs(pair.in.log);
      const amountIn = Number(
        formatUnits(outArgs?.value || 0n, pair.out.token.decimals)
      );
      const amountOut = Number(
        formatUnits(inArgs?.value || 0n, pair.in.token.decimals)
      );

      const activityId = `${txHash}-swap`;
      chunkActivities.push({
        id: activityId,
        type: "swap",
        status: "confirmed",
        timestamp,
        amount: amountIn,
        currency: pair.out.token.symbol,
        currencyIcon: pair.out.token.icon,
        swapToAmount: amountOut,
        swapToCurrency: pair.in.token.symbol,
        swapToCurrencyIcon: pair.in.token.icon,
        txHash,
      });
      processedLogIds.add(activityId);
    }

    const paymentActivityIds = new Set<string>();
    for (const entry of paymentLogs) {
      if (entry.log.blockNumber == null || !entry.log.transactionHash) {
        continue;
      }
      const args = getPaymentArgs(entry.log);
      if (!args) continue;

      const timestamp = await getBlockDate(entry.log.blockNumber);
      const logId = `${entry.log.transactionHash}-${entry.log.logIndex}-payment-${entry.role}`;
      if (paymentActivityIds.has(logId)) continue;
      paymentActivityIds.add(logId);
      processedLogIds.add(logId);

      if (entry.role === "payer") {
        const token = getTokenByAddress(args.payToken);
        if (!token) continue;
        const amount = Number(formatUnits(args.paidAmount, token.decimals));

        chunkActivities.push({
          id: logId,
          type: "send",
          status: "confirmed",
          timestamp,
          amount,
          currency: token.symbol,
          currencyIcon: token.icon,
          txHash: entry.log.transactionHash,
          fromAddress: args.payer,
          toAddress: args.recipient,
        });
      } else {
        const token = getTokenByAddress(args.requestedToken);
        if (!token) continue;
        const amount = Number(
          formatUnits(args.requestedAmount, token.decimals)
        );

        chunkActivities.push({
          id: logId,
          type: "receive",
          status: "confirmed",
          timestamp,
          amount,
          currency: token.symbol,
          currencyIcon: token.icon,
          txHash: entry.log.transactionHash,
          fromAddress: args.payer,
          toAddress: args.recipient,
        });
      }
    }

    for (const entry of transferLogs) {
      if (entry.log.blockNumber == null || !entry.log.transactionHash) {
        continue;
      }
      const logId = `${entry.log.transactionHash}-${entry.log.logIndex}`;
      if (swapLogIds.has(logId)) continue;

      // Prevent duplicates (e.g. self-transfers appearing in both send and receive lists)
      if (processedLogIds.has(logId)) continue;
      processedLogIds.add(logId);

      const args = getTransferArgs(entry.log);
      const from = (args?.from as string | undefined)?.toLowerCase();
      const to = (args?.to as string | undefined)?.toLowerCase();
      const counterparty = entry.direction === "send" ? to : from;

      if (
        counterparty === stableSwapAddress ||
        counterparty === paymentProcessorAddress ||
        counterparty === paymasterAddress
      ) {
        continue;
      }

      const timestamp = await getBlockDate(entry.log.blockNumber);
      const amount = Number(
        formatUnits(args?.value || 0n, entry.token.decimals)
      );

      chunkActivities.push({
        id: logId,
        type: entry.direction,
        status: "confirmed",
        timestamp,
        amount,
        currency: entry.token.symbol,
        currencyIcon: entry.token.icon,
        txHash: entry.log.transactionHash,
        fromAddress: args?.from as Address | undefined,
        toAddress: args?.to as Address | undefined,
      });
    }

    return chunkActivities;
  };

  try {
    const latestBlock = await publicClient.getBlockNumber();
    const minBlock =
      latestBlock > MAX_LOOKBACK_BLOCKS
        ? latestBlock - MAX_LOOKBACK_BLOCKS + 1n
        : 0n;
    let toBlock = latestBlock;
    let chunkCount = 0;

    while (toBlock >= 0n && activities.length < MAX_ACTIVITIES) {
      if (toBlock < minBlock) break;
      if (chunkCount >= MAX_CHUNKS) break;
      let fromBlock =
        toBlock > MAX_BLOCK_RANGE ? toBlock - MAX_BLOCK_RANGE + 1n : 0n;
      if (fromBlock < minBlock) {
        fromBlock = minBlock;
      }

      const range = { fromBlock, toBlock };

      const [sentByToken, receivedByToken] = await Promise.all([
        Promise.all(
          tokens.map(async (token) => {
            try {
              const logs = await getLogsSafe(
                publicClient,
                {
                  address: token.address as Address,
                  event: transferEventAbi,
                  args: { from: address },
                },
                range.fromBlock,
                range.toBlock
              );
              return logs.map((log) => ({
                log,
                token,
                direction: "send" as const,
              }));
            } catch (err) {
              console.warn(
                `Failed to fetch sent logs for ${token.symbol}:`,
                err
              );
              return [];
            }
          })
        ),
        Promise.all(
          tokens.map(async (token) => {
            try {
              const logs = await getLogsSafe(
                publicClient,
                {
                  address: token.address as Address,
                  event: transferEventAbi,
                  args: { to: address },
                },
                range.fromBlock,
                range.toBlock
              );
              return logs.map((log) => ({
                log,
                token,
                direction: "receive" as const,
              }));
            } catch (err) {
              console.warn(
                `Failed to fetch received logs for ${token.symbol}:`,
                err
              );
              return [];
            }
          })
        ),
      ]);

      const transferLogs = [...sentByToken.flat(), ...receivedByToken.flat()];

      const [paymentByPayer, paymentByRecipient] = await Promise.all([
        getLogsSafe(
          publicClient,
          {
            address: config.paymentProcessorAddress as Address,
            event: paymentCompletedEventAbi,
            args: { payer: address },
          },
          range.fromBlock,
          range.toBlock
        )
          .then((logs) => logs.map((log) => ({ log, role: "payer" as const })))
          .catch((err) => {
            console.warn("Failed to fetch payment logs (payer):", err);
            return [];
          }),
        getLogsSafe(
          publicClient,
          {
            address: config.paymentProcessorAddress as Address,
            event: paymentCompletedEventAbi,
            args: { recipient: address },
          },
          range.fromBlock,
          range.toBlock
        )
          .then((logs) =>
            logs.map((log) => ({ log, role: "recipient" as const }))
          )
          .catch((err) => {
            console.warn("Failed to fetch payment logs (recipient):", err);
            return [];
          }),
      ]);

      const chunkActivities = await buildActivitiesFromLogs(transferLogs, [
        ...paymentByPayer,
        ...paymentByRecipient,
      ]);

      activities.push(...chunkActivities);
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (activities.length >= MAX_ACTIVITIES) break;
      if (fromBlock === minBlock) break;
      toBlock = fromBlock - 1n;
      chunkCount += 1;
    }

    const trimmed = activities.slice(0, MAX_ACTIVITIES);
    if (trimmed.length === 0 && config.key === "etherlink_shadownet") {
      const fallback = await fetchBlockscoutTokenTransfers(
        walletAddress,
        config
      );
      return fallback;
    }
    return trimmed;
  } catch (err) {
    console.error("Failed to fetch activity history:", err);
    if (config.key === "etherlink_shadownet") {
      return await fetchBlockscoutTokenTransfers(walletAddress, config);
    }
    return [];
  }
}

/**
 * Group activities by month/year
 */
export function groupActivitiesByPeriod(
  activities: ActivityData[]
): GroupedActivities[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Sort activities by date (newest first)
  const sorted = [...activities].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  // Group by period
  const groups: Map<string, ActivityData[]> = new Map();

  sorted.forEach((activity) => {
    const activityYear = activity.timestamp.getFullYear();
    const activityMonth = activity.timestamp.getMonth();
    let label: string;
    if (activityYear === currentYear && activityMonth === currentMonth) {
      label = "Latest Transactions";
    } else if (
      activityYear === currentYear &&
      activityMonth === currentMonth - 1
    ) {
      label = "Last Month";
    } else if (activityYear === currentYear) {
      // Same year, different month
      label = activity.timestamp.toLocaleString("en-US", { month: "short" });
    } else {
      // Different year
      label = activityYear.toString();
    }

    const existing = groups.get(label) || [];
    existing.push(activity);
    groups.set(label, existing);
  });
  // Convert to array
  return Array.from(groups.entries()).map(([label, activities]) => ({
    label,
    activities,
  }));
}

/**
 * Format date for display
 */
export function formatActivityDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format time for display
 */
export function formatActivityTime(date: Date): string {
  return (
    date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}
