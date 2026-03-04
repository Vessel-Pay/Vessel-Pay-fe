import { keccak256, stringToHex } from "viem";

export type QrisParseResult = {
  raw: string;
  normalized: string;
  hash: `0x${string}`;
  merchantName: string;
  merchantId: string;
  merchantCity: string;
};

type TlvItem = {
  tag: string;
  length: number;
  value: string;
};

const isDigits = (value: string) => /^\d+$/.test(value);

const parseTlv = (data: string): TlvItem[] => {
  const items: TlvItem[] = [];
  let cursor = 0;

  while (cursor < data.length) {
    const tag = data.slice(cursor, cursor + 2);
    const lenStr = data.slice(cursor + 2, cursor + 4);

    if (tag.length < 2 || lenStr.length < 2) {
      throw new Error("QRIS data is truncated");
    }
    if (!isDigits(tag) || !isDigits(lenStr)) {
      throw new Error("QRIS tag/length invalid");
    }

    const length = Number(lenStr);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + length;
    const value = data.slice(valueStart, valueEnd);

    if (value.length !== length) {
      throw new Error("QRIS value length mismatch");
    }

    items.push({ tag, length, value });
    cursor = valueEnd;
  }

  return items;
};

const getTagValue = (items: TlvItem[], tag: string) =>
  items.find((item) => item.tag === tag)?.value || "";

const parseMerchantId = (items: TlvItem[]): string => {
  const merchantInfo = items.find(
    (item) => item.tag >= "26" && item.tag <= "51",
  );
  if (!merchantInfo) return "";

  try {
    const nested = parseTlv(merchantInfo.value);
    return (
      getTagValue(nested, "01") ||
      getTagValue(nested, "02") ||
      getTagValue(nested, "03")
    );
  } catch {
    return "";
  }
};

export const normalizeQrisPayload = (payload: string) => {
  const raw = payload.trim();
  if (!raw) {
    throw new Error("QRIS payload empty");
  }

  const items = parseTlv(raw);
  const normalized = items
    .filter((item) => item.tag !== "63" && item.tag !== "54")
    .map((item) => {
      const length = String(item.value.length).padStart(2, "0");
      return `${item.tag}${length}${item.value}`;
    })
    .join("");

  return { raw, normalized, items };
};

export const parseQrisPayload = (payload: string): QrisParseResult => {
  const { raw, normalized, items } = normalizeQrisPayload(payload);
  const merchantName = getTagValue(items, "59");
  const merchantCity = getTagValue(items, "60");
  const merchantId = parseMerchantId(items);

  const hash = keccak256(stringToHex(normalized));

  return {
    raw,
    normalized,
    hash,
    merchantName,
    merchantId,
    merchantCity,
  };
};
