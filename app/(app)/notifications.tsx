import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

const PRIMARY = '#1565C0';

type NotificationItem = {
  id: string;
  type: string;
  data: {
    title: string;
    body: string;
    request_id?: number;
    type?: string;
    status?: string;
    action: 'status_updated' | 'new_request' | 'new_face_request';
  };
  read_at: string | null;
  created_at: string;
};

const ACTION_ICON: Record<NotificationItem['data']['action'], keyof typeof Ionicons.glyphMap> = {
  status_updated:    'checkmark-done-outline',
  new_request:       'document-text-outline',
  new_face_request:  'scan-outline',
};

export default function NotificationsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  // Zero-trust: notifications & unread count always come fresh from the backend
  // whenever this screen gains focus — never trust a stale local cache.
  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  async function fetchNotifications(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await fetch(API_ENDPOINTS.notifications, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal memuat notifikasi.');
      setItems(json.data?.data ?? []);
      setUnread(typeof json.unread === 'number' ? json.unread : 0);
    } catch (e: any) {
      setError(e.message ?? 'Terjadi kesalahan koneksi.');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }

  async function handleMarkRead(item: NotificationItem) {
    if (item.read_at) return;
    try {
      await fetch(API_ENDPOINTS.notificationRead(item.id), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Zero-trust: re-fetch dari server — jangan pakai device timestamp untuk read_at.
      await fetchNotifications();
    } catch {
      // Best-effort.
    }
  }

  async function handleMarkAllRead() {
    if (unread === 0) return;
    setMarkingAll(true);
    try {
      await fetch(API_ENDPOINTS.notificationReadAll, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifikasi</Text>
          <TouchableOpacity
            style={[styles.iconBtn, unread === 0 && styles.iconBtnDisabled]}
            onPress={handleMarkAllRead}
            disabled={unread === 0 || markingAll}
            activeOpacity={0.75}
          >
            {markingAll
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark-done-outline" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
        {unread > 0 && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{unread} belum dibaca</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={36} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchNotifications()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={[PRIMARY]} />
          }
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color={PRIMARY} />
              </View>
              <Text style={styles.emptyTitle}>Belum Ada Notifikasi</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.read_at && styles.cardUnread]}
              onPress={() => handleMarkRead(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.cardIcon, !item.read_at && styles.cardIconUnread]}>
                <Ionicons
                  name={ACTION_ICON[item.data.action] ?? 'notifications-outline'}
                  size={18}
                  color={!item.read_at ? '#fff' : PRIMARY}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, !item.read_at && styles.cardTitleUnread]}>{item.data.title}</Text>
                <Text style={styles.cardText} numberOfLines={2}>{item.data.body}</Text>
                <Text style={styles.cardDate}>
                  {new Date(item.created_at).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              {!item.read_at && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  header: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  iconBtnDisabled: { opacity: 0.4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  unreadPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  unreadPillText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 32 },
  errorText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  retryBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardUnread: { backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#DBEAFE' },
  cardIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  cardIconUnread: { backgroundColor: PRIMARY },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#475569' },
  cardTitleUnread: { fontWeight: '800', color: '#1E293B' },
  cardText: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 4 },
});
