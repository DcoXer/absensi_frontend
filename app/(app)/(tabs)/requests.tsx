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
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

const PRIMARY = '#1565C0';

type RequestType = 'cuti' | 'izin' | 'sakit' | 'lembur';
type RequestStatus = 'pending' | 'approved' | 'rejected';

type EmployeeRequest = {
  id: number;
  type: RequestType;
  start_date: string;
  end_date: string | null;
  reason: string;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  // Lembur only (API.md §7) — auto-recorded by backend, never client-supplied.
  // started_at is set when start_photo is verified; ended_at stays null until
  // PATCH /requests/{id}/end is called.
  started_at?: string | null;
  ended_at?: string | null;
  total_overtime_minutes?: number | null;
  overtime_duration_formatted?: string | null;
};

type Quota = {
  quota_days: number;
  remaining_days: number;
  used_days: number;
  year: number;
};

const TYPE_CONFIG: Record<RequestType, {
  label: string; icon: keyof typeof Ionicons.glyphMap;
  color: string; bg: string;
}> = {
  cuti:   { label: 'Cuti',   icon: 'umbrella-outline',    color: '#7C3AED', bg: '#F5F3FF' },
  izin:   { label: 'Izin',   icon: 'hand-left-outline',   color: '#0891B2', bg: '#ECFEFF' },
  sakit:  { label: 'Sakit',  icon: 'medical-outline',     color: '#DC2626', bg: '#FEF2F2' },
  lembur: { label: 'Lembur', icon: 'time-outline',        color: '#D97706', bg: '#FFFBEB' },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Menunggu', color: '#B45309', bg: '#FEF3C7' },
  approved: { label: 'Disetujui', color: '#15803D', bg: '#DCFCE7' },
  rejected: { label: 'Ditolak',   color: '#DC2626', bg: '#FEE2E2' },
};

type FilterKey = 'semua' | RequestType | RequestStatus;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'semua',   label: 'Semua'   },
  { key: 'pending', label: 'Pending' },
  { key: 'cuti',    label: 'Cuti'    },
  { key: 'izin',    label: 'Izin'    },
  { key: 'sakit',   label: 'Sakit'   },
  { key: 'lembur',  label: 'Lembur'  },
];

export default function RequestsScreen() {
  const { token } = useAuth();
  const insets    = useSafeAreaInsets();

  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [quota, setQuota]       = useState<Quota | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterKey>('semua');

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  async function fetchAll() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [rRes, qRes] = await Promise.all([
        fetch(API_ENDPOINTS.requests, { headers }),
        fetch(API_ENDPOINTS.requestsQuota, { headers }),
      ]);
      const rJson = await rRes.json();
      const qJson = await qRes.json();

      const raw: any[] = rJson.data?.data ?? rJson.data ?? [];
      setRequests(raw);
      if (qJson.status === 'success') setQuota(qJson.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === 'semua'
    ? requests
    : requests.filter(r => r.type === filter || r.status === filter);

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Pengajuan</Text>
              <Text style={styles.headerSub}>Cuti · Izin · Sakit · Lembur</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/(app)/request-form')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Quota bar */}
          {quota && (
            <View style={styles.quotaCard}>
              <View style={styles.quotaRow}>
                <View>
                  <Text style={styles.quotaLabel}>Sisa Kuota Cuti</Text>
                  <View style={styles.quotaNumRow}>
                    <Text style={styles.quotaNum}>{quota.remaining_days}</Text>
                    <Text style={styles.quotaDenom}>/{quota.quota_days} hari</Text>
                  </View>
                </View>
                <View style={styles.quotaRight}>
                  <Text style={styles.quotaUsed}>{quota.used_days} hari terpakai</Text>
                </View>
              </View>
              <View style={styles.quotaTrack}>
                <View style={[
                  styles.quotaFill,
                  { width: `${Math.round((quota.remaining_days / quota.quota_days) * 100)}%` },
                ]} />
              </View>
            </View>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={styles.filterWrap}>
              <FlatList
                horizontal
                data={FILTERS}
                keyExtractor={f => f.key}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item: f }) => (
                  <TouchableOpacity
                    style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={styles.emptyText}>Memuat pengajuan...</Text>
              </View>
            ) : (
              <View style={styles.centerBox}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="document-text-outline" size={36} color={PRIMARY} />
                </View>
                <Text style={styles.emptyTitle}>Belum Ada Pengajuan</Text>
                <Text style={styles.emptyText}>Buat pengajuan baru dengan tombol + di atas</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <RequestCard item={item} onCancel={fetchAll} token={token!} />
          )}
        />
      </View>
    </>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({
  item, onCancel, token,
}: {
  item: EmployeeRequest;
  onCancel: () => void;
  token: string;
}) {
  const type   = TYPE_CONFIG[item.type]   ?? TYPE_CONFIG.izin;
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const [cancelling, setCancelling] = useState(false);

  const dateLabel = (() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const fmtTime = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    if (item.type === 'lembur') {
      return `${fmt(item.start_date)}  ${fmtTime(item.started_at)} – ${fmtTime(item.ended_at)}`;
    }
    if (item.end_date && item.end_date !== item.start_date) {
      return `${fmt(item.start_date)} – ${fmt(item.end_date)}`;
    }
    return fmt(item.start_date);
  })();

  async function handleCancel() {
    setCancelling(true);
    try {
      await fetch(API_ENDPOINTS.requestDetail(item.id), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onCancel();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: type.bg }]}>
          <Ionicons name={type.icon} size={14} color={type.color} />
          <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.label}</Text>
        </View>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.cardDate}>{dateLabel}</Text>
      <Text style={styles.cardReason} numberOfLines={2}>{item.reason}</Text>

      {item.type === 'lembur' && item.ended_at && item.overtime_duration_formatted && (
        <View style={styles.overtimeChip}>
          <Ionicons name="hourglass-outline" size={12} color={TYPE_CONFIG.lembur.color} />
          <Text style={styles.overtimeChipText}>Total lembur: {item.overtime_duration_formatted}</Text>
        </View>
      )}

      {item.admin_notes && (
        <View style={styles.notesRow}>
          <Ionicons name="chatbubble-outline" size={12} color="#64748B" />
          <Text style={styles.notesText}>{item.admin_notes}</Text>
        </View>
      )}

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={cancelling}
          activeOpacity={0.8}
        >
          {cancelling
            ? <ActivityIndicator size="small" color="#DC2626" />
            : <><Ionicons name="close-circle-outline" size={14} color="#DC2626" /><Text style={styles.cancelBtnText}>Batalkan</Text></>
          }
        </TouchableOpacity>
      )}

      {item.type === 'lembur' && item.status === 'approved' && !item.ended_at && (
        <TouchableOpacity
          style={styles.endLemburBtn}
          onPress={() => router.push({ pathname: '/(app)/lembur-end', params: { id: String(item.id) } })}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={14} color="#fff" />
          <Text style={styles.endLemburBtnText}>Selesaikan Lembur</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },
  addBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Quota card
  quotaCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 14, padding: 14, gap: 10,
  },
  quotaRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  quotaLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' },
  quotaNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 },
  quotaNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  quotaDenom: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  quotaRight: { alignItems: 'flex-end' },
  quotaUsed: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  quotaTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden',
  },
  quotaFill: { height: '100%', borderRadius: 3, backgroundColor: '#4ADE80' },

  // Filter
  filterWrap: { paddingTop: 14, paddingBottom: 4 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, gap: 10 },

  // Empty / loading
  centerBox: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  emptyText:  { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, gap: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  cardDate:   { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardReason: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  overtimeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 8, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  overtimeChipText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  notesRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8,
  },
  notesText: { fontSize: 12, color: '#64748B', flex: 1, lineHeight: 17 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 10,
    paddingVertical: 8, backgroundColor: '#FEF2F2', marginTop: 2,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  endLemburBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 8, marginTop: 2,
    backgroundColor: '#D97706',
  },
  endLemburBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
