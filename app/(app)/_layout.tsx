import { Stack } from 'expo-router';
import { View } from 'react-native';
import SyncStatusBar from '@/components/SyncStatusBar';
import { useColors } from '@/store/theme';

export default function AppLayout() {
  const c = useColors();

  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBar />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.header },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          contentStyle: { backgroundColor: c.bg },
        }}
      />
    </View>
  );
}
