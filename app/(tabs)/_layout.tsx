import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/store/theme';
import SyncStatusBar from '@/components/SyncStatusBar';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconsName; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabsLayout() {
  const c = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SyncStatusBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border, borderTopWidth: 1 },
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.tabBarIcon,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'briefcase' : 'briefcase-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
