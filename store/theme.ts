import { create } from 'zustand';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, Colors } from '@/lib/colors';

export type { Colors };

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  setMode: async (mode) => {
    set({ mode });
    await AsyncStorage.setItem('theme_mode', mode);
  },
  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme_mode');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ mode: stored as ThemeMode });
      }
    } catch {}
  },
}));

export function useColors(): Colors {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return isDark ? dark : light;
}

export function useIsDark(): boolean {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  return mode === 'dark' || (mode === 'system' && system === 'dark');
}
