import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import OfflineBanner from '@/components/OfflineBanner';

export default function AppLayout() {
  return (
    <View style={styles.container}>
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          contentStyle: { backgroundColor: '#F3F4F6' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
