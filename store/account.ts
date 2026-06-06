import { create } from 'zustand';

export type BlockReason = 'SUBSCRIPTION_EXPIRED' | 'ACCOUNT_FROZEN' | null;

interface AccountState {
  blockReason: BlockReason;
  setBlockReason: (reason: BlockReason) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  blockReason: null,
  setBlockReason: (blockReason) => set({ blockReason }),
}));
