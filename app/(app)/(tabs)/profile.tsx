import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

const PRIMARY = '#1565C0';

export default function ProfileScreen() {
  const { user, token, signOut, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Zero-trust: don't just trust the cached login snapshot — refresh from
  // the backend's source of truth every time the profile tab gains focus.
  useFocusEffect(useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    fetch(API_ENDPOINTS.profile, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(json => { if (json.status === 'success' && json.data) updateUser(json.data); })
      .catch(() => { /* keep showing cached data if offline */ })
      .finally(() => setRefreshing(false));

    fetch(API_ENDPOINTS.notifications, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(json => setUnreadCount(typeof json.unread === 'number' ? json.unread : 0))
      .catch(() => { /* keep previous count if offline */ });
  }, [token]));

  const initials = (user?.name ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  async function handlePickAvatar() {
    Alert.alert('Foto Profil', 'Pilih sumber foto', [
      {
        text: 'Kamera',
        onPress: async () => {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();
          if (!granted) { Alert.alert('Izin kamera ditolak'); return; }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
          });
          if (!result.canceled && result.assets[0]?.base64) uploadAvatar(result.assets[0].base64);
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!granted) { Alert.alert('Izin galeri ditolak'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
            mediaTypes: 'images', base64: true,
          });
          if (!result.canceled && result.assets[0]?.base64) uploadAvatar(result.assets[0].base64);
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  }

  // Zero-trust: setelah upload, jangan trust response upload langsung — re-fetch
  // GET /profile supaya server yang jadi satu-satunya sumber kebenaran.
  async function uploadAvatar(base64: string) {
    setUploadingPhoto(true);
    try {
      const res = await fetch(API_ENDPOINTS.profilePhoto, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photo: base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal mengunggah foto profil.');
      // Re-fetch profil dari server — server adalah satu-satunya sumber kebenaran.
      const profileRes = await fetch(API_ENDPOINTS.profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileJson = await profileRes.json();
      if (profileJson.status === 'success' && profileJson.data) {
        await updateUser(profileJson.data);
      }
    } catch (e: any) {
      Alert.alert('Gagal', e.message ?? 'Terjadi kesalahan koneksi.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Keluar Akun',
      'Apakah kamu yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: signOut },
      ],
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          {/* Avatar */}
          <TouchableOpacity
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            style={styles.avatarBtn}
            disabled={uploadingPhoto}
          >
            <View style={styles.avatarWrap}>
              {user?.profile_photo_url ? (
                <ExpoImage
                  source={{
                    uri: user.profile_photo_url,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  cachePolicy="none"
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              {uploadingPhoto && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{user?.name ?? '-'}</Text>
          <Text style={styles.email}>{user?.email ?? '-'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'admin' ? 'Administrator' : 'Karyawan'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Info card */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Informasi Akun</Text>
              {refreshing && <ActivityIndicator size="small" color="#94A3B8" />}
            </View>
            <InfoRow icon="person-outline"          label="Nama Lengkap" value={user?.name ?? '-'} />
            <Divider />
            <InfoRow icon="mail-outline"             label="Email"        value={user?.email ?? '-'} />
            <Divider />
            <InfoRow icon="call-outline"             label="Nomor HP"     value={user?.phone ?? '-'} />
            <Divider />
            <InfoRow icon="briefcase-outline"        label="Jabatan"      value={user?.jabatan ?? 'Belum ditetapkan'} />
            <Divider />
            <InfoRow icon="id-card-outline"          label="ID Karyawan"  value={user?.employee_id ?? '-'} mono />
            <Divider />
            <InfoRow
              icon="shield-checkmark-outline"
              label="Status Akun"
              value={user?.is_active ? 'Aktif' : 'Tidak Aktif'}
              valueColor={user?.is_active ? '#16A34A' : '#DC2626'}
            />
          </View>

          {/* Menu */}
          <View style={styles.card}>
            <MenuRow
              icon="create-outline"
              label="Edit Profil"
              onPress={() => router.push('/(app)/edit-profile')}
            />
            <Divider />
            <MenuRow
              icon="lock-closed-outline"
              label="Ganti Password"
              onPress={() => router.push('/(app)/change-password')}
            />
            <Divider />
            <MenuRow
              icon="scan-outline"
              label="Ganti Foto Wajah Referensi"
              onPress={() => router.push('/(app)/face-request')}
            />
            <Divider />
            <MenuRow
              icon="notifications-outline"
              label="Notifikasi"
              badge={unreadCount > 0 ? unreadCount : undefined}
              onPress={() => router.push('/(app)/notifications')}
            />
          </View>

          {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.signOutText}>Keluar dari Akun</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, mono, valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[
          styles.infoValue,
          mono && styles.infoValueMono,
          valueColor ? { color: valueColor } : {},
        ]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon, label, onPress, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {!!badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    paddingBottom: 28,
    gap: 6,
  },
  avatarBtn: { marginBottom: 8 },
  avatarWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PRIMARY,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  name:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginTop: 2,
  },
  roleText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  content: { padding: 16, gap: 14 },

  // Info card
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    overflow: 'hidden',
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 14,
  },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginTop: 2 },
  infoValueMono: { fontFamily: 'monospace', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 18 },

  // Menu
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 14,
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' },
  menuBadge: {
    backgroundColor: '#DC2626', borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  menuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
