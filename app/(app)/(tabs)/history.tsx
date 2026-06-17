import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

type AttendanceRecord = {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'hadir' | 'terlambat' | 'tidak_hadir';
  workingMinutes: number | null;
};

type FilterKey = 'semua' | 'hadir' | 'terlambat' | 'tidak_hadir';

const STATUS_CONFIG: Record<
  AttendanceRecord['status'],
  { label: string; color: string; bg: string; tint: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  hadir:       { label: 'Hadir',       color: '#15803D', bg: '#DCFCE7', tint: '#F0FDF4', icon: 'checkmark-circle' },
  terlambat:   { label: 'Terlambat',   color: '#B45309', bg: '#FEF3C7', tint: '#FFFBEB', icon: 'time'             },
  tidak_hadir: { label: 'Tidak Hadir', color: '#DC2626', bg: '#FEE2E2', tint: '#FEF2F2', icon: 'close-circle'     },
};

const BORDER_COLOR: Record<AttendanceRecord['status'], string> = {
  hadir: '#16A34A',
  terlambat: '#D97706',
  tidak_hadir: '#EF4444',
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'semua',       label: 'Semua'       },
  { key: 'hadir',       label: 'Hadir'       },
  { key: 'terlambat',   label: 'Terlambat'   },
  { key: 'tidak_hadir', label: 'Tidak Hadir' },
];

export default function HistoryScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('semua');

  // Zero-trust: re-fetch setiap kali tab ini aktif supaya data selalu dari server.
  useFocusEffect(useCallback(() => { fetchHistory(); }, []));

  async function fetchHistory() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_ENDPOINTS.history, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Backend returns paginated, already grouped per day:
      // data.data.data is an array of { date, check_in, check_out, working_minutes, ... }
      const rawRecords: any[] = data.data?.data ?? data.data ?? [];

      const toTime = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;

      const parsed: AttendanceRecord[] = rawRecords
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map((rec) => {
          const { check_in, check_out } = rec;

          let status: AttendanceRecord['status'] = 'tidak_hadir';
          if (check_in) {
            status = check_in.is_late ? 'terlambat' : 'hadir';
          }

          return {
            id: String(check_in?.id ?? check_out?.id ?? rec.date),
            date: rec.date,
            check_in_time: toTime(check_in?.created_at),
            check_out_time: toTime(check_out?.created_at),
            status,
            workingMinutes: typeof rec.working_minutes === 'number' ? rec.working_minutes : null,
          };
        });

      setRecords(parsed);
    } catch {
      setError('Gagal memuat riwayat absensi.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === 'semua' ? records : records.filter(r => r.status === filter);

  const stats = {
    hadir:       records.filter(r => r.status === 'hadir').length,
    terlambat:   records.filter(r => r.status === 'terlambat').length,
    tidak_hadir: records.filter(r => r.status === 'tidak_hadir').length,
  };

  const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const header = (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.pageHeader, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.pageTitle}>Riwayat Absensi</Text>
        <Text style={styles.monthLabel}>{currentMonth}</Text>

        {/* Stats strip */}
        {!loading && (
          <View style={styles.statsStrip}>
            <StatStrip value={stats.hadir}       label="Hadir"     color="#4ADE80" />
            <View style={styles.statsDivider} />
            <StatStrip value={stats.terlambat}   label="Terlambat" color="#FCD34D" />
            <View style={styles.statsDivider} />
            <StatStrip value={stats.tidak_hadir} label="Tidak Hadir" color="#FCA5A5" />
          </View>
        )}
      </View>
    </>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        {header}
        <View style={styles.skeletonFilterRow}>
          {[1,2,3,4].map(i => <View key={i} style={styles.skeletonFilter} />)}
        </View>
        {[1,2,3,4].map(i => (
          <View key={i} style={styles.skeletonCard}>
            <View style={styles.skeletonCardTop} />
            <View style={styles.skeletonCardBottom} />
          </View>
        ))}
        <View style={styles.skeletonSpinner}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Memuat riwayat...</Text>
        </View>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.root, { flex: 1 }]}>
        {header}
        <View style={styles.stateContainer}>
          <View style={styles.errorIconWrap}>
            <View style={styles.errorIconOuter}>
              <Ionicons name="cloud-offline-outline" size={36} color="#EF4444" />
            </View>
          </View>
          <Text style={styles.stateTitle}>Gagal Memuat Data</Text>
          <Text style={styles.stateSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {header}
      <FlatList
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Filter tabs */}
            <View style={styles.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Count label */}
            <Text style={styles.countLabel}>
              {filtered.length} {filtered.length === 1 ? 'catatan' : 'catatan'}
              {filter !== 'semua' ? ` · ${FILTERS.find(f => f.key === filter)?.label}` : ''}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={40} color={PRIMARY} />
            </View>
            <Text style={styles.stateTitle}>Tidak Ada Data</Text>
            <Text style={styles.stateSubtitle}>
              {filter === 'semua'
                ? 'Belum ada catatan absensi.'
                : `Tidak ada catatan dengan status "${FILTERS.find(f => f.key === filter)?.label}".`}
            </Text>
          </View>
        }
        renderItem={({ item }) => <RecordCard item={item} />}
      />
    </View>
  );
}

// ── RecordCard ───────────────────────────────────────────────────────────────

function RecordCard({ item }: { item: AttendanceRecord }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.tidak_hadir;
  const border = BORDER_COLOR[item.status] ?? '#EF4444';
  const duration = getDuration(item.workingMinutes);

  return (
    <View style={[styles.card, { borderLeftColor: border }]}>

      {/* Header with status tint */}
      <View style={[styles.cardHeader, { backgroundColor: cfg.tint }]}>
        <View>
          <Text style={styles.cardDay}>{getDayName(item.date)}</Text>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Time row */}
      <View style={styles.cardBody}>
        <TimeBlock icon="log-in-outline"  label="Masuk"  value={item.check_in_time}  />
        <View style={styles.timeDivider}>
          <View style={styles.timeDividerLine} />
          {duration && (
            <View style={styles.durationChip}>
              <Ionicons name="hourglass-outline" size={10} color="#94A3B8" />
              <Text style={styles.durationText} numberOfLines={1}>{duration}</Text>
            </View>
          )}
          <View style={styles.timeDividerLine} />
        </View>
        <TimeBlock icon="log-out-outline" label="Keluar" value={item.check_out_time} alignRight />
      </View>

    </View>
  );
}

function TimeBlock({
  icon, label, value, alignRight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null;
  alignRight?: boolean;
}) {
  const filled = !!value;
  return (
    <View style={[styles.timeBlock, alignRight && styles.timeBlockRight]}>
      <View style={[styles.timeIconWrap, filled && styles.timeIconWrapFilled]}>
        <Ionicons name={icon} size={14} color={filled ? PRIMARY : '#CBD5E1'} />
      </View>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={[styles.timeValue, !filled && styles.timeValueEmpty]}>
        {value ?? '--:--'}
      </Text>
    </View>
  );
}

function StatStrip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.statStripItem}>
      <Text style={[styles.statStripValue, { color }]}>{value}</Text>
      <Text style={styles.statStripLabel}>{label}</Text>
    </View>
  );
}

function StatChip({
  icon, label, value, color, bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function getDayName(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long' });
  } catch { return ''; }
}

function getDuration(workingMinutes: number | null): string | null {
  if (workingMinutes === null) return null;
  if (workingMinutes <= 0) return '< 1 menit';
  const h = Math.floor(workingMinutes / 60);
  const m = workingMinutes % 60;
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}

// ── Constants & styles ────────────────────────────────────────────────────────

const PRIMARY = '#1565C0';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },
  listContent: { padding: 16, gap: 0 },

  // Custom header
  pageHeader: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12, marginBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  monthLabel: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    marginBottom: 16,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 14, paddingVertical: 14,
  },
  statStripItem: { flex: 1, alignItems: 'center', gap: 2 },
  statStripValue: { fontSize: 22, fontWeight: '800' },
  statStripLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },

  // Skeleton
  skeletonFilterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16, marginBottom: 16 },
  skeletonFilter: { height: 32, flex: 1, backgroundColor: '#E2E8F0', borderRadius: 20 },
  skeletonCard: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16,
    marginBottom: 12, overflow: 'hidden',
  },
  skeletonCardTop: { height: 56, backgroundColor: '#F1F5F9' },
  skeletonCardBottom: { height: 64, backgroundColor: '#F8FAFC', margin: 12, borderRadius: 10 },
  skeletonSpinner: { alignItems: 'center', paddingTop: 8, gap: 8 },
  loadingText: { color: '#94A3B8', fontSize: 14 },

  // Error / empty
  stateContainer: {
    flex: 1, backgroundColor: '#EFF3FB',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10,
  },
  errorIconWrap: { marginBottom: 8 },
  errorIconOuter: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  emptyContainer: { alignItems: 'center', paddingTop: 48, paddingBottom: 16, gap: 10 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stateTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  stateSubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statChip: {
    flex: 1, alignItems: 'center', borderRadius: 14,
    paddingVertical: 12, gap: 3,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },

  // Filter tabs
  filterRow: {
    flexDirection: 'row', backgroundColor: '#E2E8F0',
    borderRadius: 14, padding: 4, marginBottom: 14, gap: 2,
  },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  filterTabText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  filterTabTextActive: { color: PRIMARY },

  countLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 10 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 12, borderLeftWidth: 4,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  cardDay: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  cardDate: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  cardBody: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  timeBlock: { flex: 0.8, alignItems: 'flex-start', gap: 4 },
  timeBlockRight: { alignItems: 'flex-end' },
  timeIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  timeIconWrapFilled: { backgroundColor: '#EFF6FF' },
  timeLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  timeValue: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  timeValueEmpty: { color: '#CBD5E1', fontWeight: '600' },

  timeDivider: { flex: 1.4, alignItems: 'center', gap: 4 },
  timeDividerLine: { height: 1, backgroundColor: '#E2E8F0', width: '100%' },
  durationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  durationText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
});
