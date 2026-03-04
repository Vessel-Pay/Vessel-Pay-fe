"use client";

import { useChainContext } from "@/providers/ChainProvider";

export function useActiveChain() {
  return useChainContext();
}
