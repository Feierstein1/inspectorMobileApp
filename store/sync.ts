import { create } from 'zustand';

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  setOnline: (v: boolean) => void;
  setPendingCount: (v: number) => void;
  setSyncing: (v: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
