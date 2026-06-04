import { create } from 'zustand';

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  pendingItemIds: string[];
  failedCount: number;
  failedPhotoCount: number;
  forbiddenCount: number;
  isSyncing: boolean;
  setOnline: (v: boolean) => void;
  setPendingCount: (v: number) => void;
  setPendingItemIds: (ids: string[]) => void;
  setFailedCount: (v: number) => void;
  setFailedPhotoCount: (v: number) => void;
  setForbiddenCount: (v: number) => void;
  setSyncing: (v: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  pendingItemIds: [],
  failedCount: 0,
  failedPhotoCount: 0,
  forbiddenCount: 0,
  isSyncing: false,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setPendingItemIds: (pendingItemIds) => set({ pendingItemIds }),
  setFailedCount: (failedCount) => set({ failedCount }),
  setFailedPhotoCount: (failedPhotoCount) => set({ failedPhotoCount }),
  setForbiddenCount: (forbiddenCount) => set({ forbiddenCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
