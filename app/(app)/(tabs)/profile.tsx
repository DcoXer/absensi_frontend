import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/context/AuthContext';

const PRIMARY = '#1565C0';
const AVATAR_KEY = 'user_avatar_uri';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(uri => { if (uri) setAvatarUri(uri); });
  }, []);

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
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) saveAvatar(result.assets[0].uri);
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!granted) { Alert.alert('Izin galeri ditolak'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
            mediaTypes: 'images',
          });
          if (!result.canceled && result.assets[0]) saveAvatar(result.assets[0].uri);
        },
      },
      avatarUri
        ? { text: 'Hapus Foto', style: 'destructive', onPress: removeAvatar }
        : { text: 'Batal', style: 'cancel' },
      ...(avatarUri ? [{ text: 'Batal', style: 'cancel' as const }] : []),
    ]);
  }

  async function saveAvatar(uri: string) {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
    setAvatarUri(uri);
  }

  async function removeAvatar() {
    await AsyncStorage.removeItem(AVATAR_KEY);
    setAvatarUri(null);
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
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarBtn}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
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
            <Text style={styles.cardTitle}>Informasi Akun</Text>
            <InfoRow icon="person-outline"          label="Nama Lengkap" value={user?.name ?? '-'} />
            <Divider />
            <InfoRow icon="mail-outline"             label="Email"        value={user?.email ?? '-'} />
            <Divider />
            <InfoRow icon="call-outline"             label="Nomor HP"     value={user?.phone ?? '-'} />
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
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4,
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

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
