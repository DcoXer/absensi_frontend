import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const PRIMARY = '#1565C0';

const TABS = [
  { name: 'index',    label: 'Beranda',   icon: 'home'             },
  { name: 'history',  label: 'Riwayat',   icon: 'time'             },
  { name: 'requests', label: 'Pengajuan', icon: 'document-text'    },
  { name: 'profile',  label: 'Profil',    icon: 'person'           },
] as const;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = TABS[index];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Ionicons
                name={isFocused ? tab.icon : `${tab.icon}-outline` as any}
                size={22}
                color={isFocused ? PRIMARY : '#94A3B8'}
              />
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    />
      <Tabs.Screen name="history"  />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="profile"  />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  iconWrap: {
    width: 44, height: 32, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#EFF6FF',
  },
  label: {
    fontSize: 11, fontWeight: '600', color: '#94A3B8',
  },
  labelActive: {
    color: PRIMARY,
  },
});
