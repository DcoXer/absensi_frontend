import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

const AVATAR_KEY = 'user_avatar_uri';

type TodayStatus = {
  checked_in: boolean;
  check_in_time: string | null;
  checked_out: boolean;
  check_out_time: string | null;
};

const PRIMARY = '#1565C0';
const SUCCESS = '#16A34A';
const WARNING = '#D97706';
const { width: SCREEN_W } = Dimensions.get('window');

type TimeOfDay = 'subuh' | 'pagi' | 'siang' | 'sore' | 'malam' | 'tengahmalam';

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 4  && hour < 6)  return 'subuh';
  if (hour >= 6  && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  if (hour >= 18 && hour < 23) return 'malam';
  return 'tengahmalam';
}

function getTimeColor(hour: number): string {
  const t = getTimeOfDay(hour);
  switch (t) {
    case 'subuh':      return '#1E3A5F'; // biru gelap fajar
    case 'pagi':       return '#B45309'; // amber hangat
    case 'siang':      return '#1565C0'; // biru terang
    case 'sore':       return '#9A3412'; // oranye sore
    case 'malam':      return '#312E81'; // indigo malam
    case 'tengahmalam':return '#0F172A'; // hitam malam
  }
}

function getGreeting(hour: number): string {
  const t = getTimeOfDay(hour);
  switch (t) {
    case 'subuh':      return 'Selamat subuh,';
    case 'pagi':       return 'Selamat pagi,';
    case 'siang':      return 'Selamat siang,';
    case 'sore':       return 'Selamat sore,';
    case 'malam':      return 'Selamat malam,';
    case 'tengahmalam':return 'Masih terjaga,';
  }
}

export default function HomeScreen() {
  const { user, token, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [status, setStatus]     = useState<TodayStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [clock, setClock]       = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(uri => { if (uri) setAvatarUri(uri); });
  }, []);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Pulse animation — only when there's an action pending
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => { fetchToday(); }, []);

  async function fetchToday() {
    setLoading(true);
    try {
      const res  = await fetch(API_ENDPOINTS.today, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const d    = json.data;

      const toTime = (iso?: string | null) =>
        iso
          ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : null;

      setStatus({
        checked_in:     !!d?.check_in,
        check_in_time:  toTime(d?.check_in?.created_at),
        checked_out:    !!d?.check_out,
        check_out_time: toTime(d?.check_out?.created_at),
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const initials = (user?.name ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  const bothDone    = !!(status?.checked_in && status?.checked_out);
  const needCheckOut = !!(status?.checked_in && !status?.checked_out);

  function handleAbsen() {
    if (bothDone) return;
    router.push({
      pathname: '/(app)/check-in',
      params: { type: needCheckOut ? 'check_out' : 'check_in' },
    });
  }

  // Hero color based on time of day
  const heroColor = getTimeColor(new Date().getHours());

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>

        {/* ── Hero Header ── */}
        <View style={[styles.hero, { backgroundColor: heroColor, paddingTop: insets.top + 14 }]}>
          {/* Top row: greeting + avatar */}
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getGreeting(new Date().getHours())}</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name?.split(' ')[0] ?? 'Karyawan'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push('/(app)/(tabs)/profile')}
              activeOpacity={0.8}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Clock + Date */}
          <Text style={styles.clock}>{clock}</Text>
          <Text style={styles.date}>{today}</Text>

          {/* Status pill */}
          <View style={styles.statusPill}>
            <View style={[
              styles.statusDot,
              { backgroundColor: bothDone ? '#4ADE80' : needCheckOut ? '#FCD34D' : '#93C5FD' },
            ]} />
            <Text style={styles.statusPillText}>
              {bothDone
                ? 'Absensi lengkap hari ini'
                : needCheckOut
                ? 'Sudah masuk · belum pulang'
                : 'Belum absen hari ini'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Attendance Card ── */}
          <View style={styles.attendCard}>
            {/* Card header */}
            <View style={styles.attendCardHeader}>
              <Text style={styles.attendCardTitle}>Kehadiran Hari Ini</Text>
              {!loading && bothDone && status?.check_in_time && status?.check_out_time && (
                <View style={styles.durationChip}>
                  <Ionicons name="timer-outline" size={12} color="#16A34A" />
                  <Text style={styles.durationChipText}>
                    {calcDuration(status.check_in_time, status.check_out_time)}
                  </Text>
                </View>
              )}
            </View>

            {/* Row: Masuk */}
            <View style={[styles.attendRow, (status?.checked_in) && styles.attendRowDone]}>
              <View style={styles.attendRowLeft}>
                <View style={[
                  styles.attendDot,
                  status?.checked_in ? styles.attendDotIn : styles.attendDotEmpty,
                ]}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons
                        name={status?.checked_in ? 'checkmark' : 'log-in-outline'}
                        size={16}
                        color={status?.checked_in ? '#fff' : '#94A3B8'}
                      />
                  }
                </View>
                <View style={styles.attendConnector} />
              </View>
              <View style={styles.attendRowBody}>
                <Text style={styles.attendRowLabel}>Absen Masuk</Text>
                <Text style={[
                  styles.attendRowStatus,
                  { color: status?.checked_in ? SUCCESS : '#94A3B8' },
                ]}>
                  {status?.checked_in ? 'Sudah tercatat' : 'Belum absen masuk'}
                </Text>
              </View>
              <Text style={[
                styles.attendRowTime,
                { color: status?.checked_in ? SUCCESS : '#CBD5E1' },
              ]}>
                {status?.check_in_time ?? '--:--'}
              </Text>
            </View>

            {/* Row: Pulang */}
            <View style={[styles.attendRow, styles.attendRowLast, (status?.checked_out) && styles.attendRowDone]}>
              <View style={styles.attendRowLeft}>
                <View style={[
                  styles.attendDot,
                  status?.checked_out ? styles.attendDotOut : styles.attendDotEmpty,
                ]}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons
                        name={status?.checked_out ? 'checkmark' : 'log-out-outline'}
                        size={16}
                        color={status?.checked_out ? '#fff' : '#94A3B8'}
                      />
                  }
                </View>
              </View>
              <View style={styles.attendRowBody}>
                <Text style={styles.attendRowLabel}>Absen Pulang</Text>
                <Text style={[
                  styles.attendRowStatus,
                  { color: status?.checked_out ? WARNING : '#94A3B8' },
                ]}>
                  {status?.checked_out ? 'Sudah tercatat' : 'Belum absen pulang'}
                </Text>
              </View>
              <Text style={[
                styles.attendRowTime,
                { color: status?.checked_out ? WARNING : '#CBD5E1' },
              ]}>
                {status?.check_out_time ?? '--:--'}
              </Text>
            </View>
          </View>

          {/* ── CTA ── */}
          {!loading && (
            bothDone ? (
              <View style={styles.doneBanner}>
                <View style={styles.doneIconWrap}>
                  <Ionicons name="checkmark-circle" size={32} color={SUCCESS} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doneTitle}>Absensi Selesai!</Text>
                  <View style={styles.doneSubRow}>
                    <Ionicons name="star" size={12} color="#4ADE80" />
                    <Text style={styles.doneSub}>Sampai jumpa besok</Text>
                  </View>
                </View>
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.doneBadgeText}>Lengkap</Text>
                </View>
              </View>
            ) : (
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <TouchableOpacity
                  style={[styles.ctaBtn, needCheckOut && styles.ctaBtnOut]}
                  onPress={handleAbsen}
                  activeOpacity={0.88}
                >
                  <View style={styles.ctaBtnLeft}>
                    <View style={styles.ctaBtnIcon}>
                      <Ionicons
                        name={needCheckOut ? 'log-out' : 'log-in'}
                        size={28}
                        color="#fff"
                      />
                    </View>
                    <View>
                      <Text style={styles.ctaBtnTitle}>
                        {needCheckOut ? 'Absen Pulang' : 'Absen Masuk'}
                      </Text>
                      <Text style={styles.ctaBtnSub}>
                        {needCheckOut
                          ? 'Konfirmasi wajah & lokasi sebelum pulang'
                          : 'Verifikasi GPS & wajah untuk mulai kerja'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ctaArrow}>
                    <Ionicons name="chevron-forward" size={22} color="#fff" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )
          )}

        </ScrollView>
      </View>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDuration(inTime: string, outTime: string): string {
  // inTime/outTime are "HH:MM"
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  const totalMins = (oh * 60 + om) - (ih * 60 + im);
  if (totalMins <= 0) return '-';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  // Hero
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  clock: {
    fontSize: 38, fontWeight: '800', color: '#fff',
    marginTop: 20, fontVariant: ['tabular-nums'], letterSpacing: 1,
  },
  date: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '500' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Attendance card
  attendCard: {
    backgroundColor: '#fff', borderRadius: 20,
    shadowColor: '#1565C0', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },
  attendCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  attendCardTitle: {
    fontSize: 13, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  durationChipText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  attendRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingRight: 18, paddingVertical: 14,
  },
  attendRowLast: { paddingBottom: 18 },
  attendRowDone: { backgroundColor: '#FAFFFE' },
  attendRowLeft: { width: 56, alignItems: 'center' },
  attendDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  attendDotIn:    { backgroundColor: SUCCESS },
  attendDotOut:   { backgroundColor: WARNING },
  attendDotEmpty: { backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#E2E8F0' },
  attendConnector: {
    width: 2, flex: 1, minHeight: 16,
    backgroundColor: '#E2E8F0', marginTop: 4,
  },
  attendRowBody: { flex: 1, gap: 2 },
  attendRowLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  attendRowStatus: { fontSize: 12, fontWeight: '500' },
  attendRowTime: {
    fontSize: 18, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: 0.5,
  },

  // CTA
  ctaBtn: {
    backgroundColor: PRIMARY, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 20, gap: 14,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  ctaBtnOut: { backgroundColor: WARNING, shadowColor: WARNING },
  ctaBtnLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaBtnIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  ctaBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3, lineHeight: 17, maxWidth: 180 },
  ctaArrow: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Done banner
  doneBanner: {
    backgroundColor: '#F0FDF4', borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#BBF7D0',
    shadowColor: SUCCESS, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  doneIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { fontSize: 16, fontWeight: '800', color: '#15803D' },
  doneSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  doneSub: { fontSize: 12, color: '#4ADE80', fontWeight: '500' },
  doneBadge: {
    backgroundColor: SUCCESS, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  doneBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

});
