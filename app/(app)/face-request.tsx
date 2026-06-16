import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';
import OvalCameraOverlay from '@/components/OvalCameraOverlay';

const PRIMARY = '#1565C0';
const SUCCESS = '#16A34A';
const WARNING = '#D97706';
const DANGER  = '#DC2626';

type FaceRequestStatus = {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
} | null;

export default function FaceRequestScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState<FaceRequestStatus>(null);
  const [statusError, setStatusError] = useState('');

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Zero-trust: status is whatever the backend currently says — re-fetch every time
  // this screen gains focus rather than trusting a stale local copy.
  useFocusEffect(useCallback(() => { fetchStatus(); }, []));

  async function fetchStatus() {
    setLoadingStatus(true); setStatusError('');
    try {
      const res = await fetch(API_ENDPOINTS.faceRequest, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal memuat status.');
      setStatus(json.data ?? null);
    } catch (e: any) {
      setStatusError(e.message ?? 'Terjadi kesalahan koneksi.');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function handleOpenCamera() {
    setSubmitError('');
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) { setSubmitError('Izin kamera ditolak.'); return; }
    }
    setMode('camera');
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    setSubmitError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7, imageType: 'jpg' });
      if (!captured) throw new Error('Foto tidak berhasil diambil.');
      setPhoto(captured);
      setMode('preview');
    } catch (e: any) {
      setSubmitError(e.message ?? 'Gagal mengambil foto.');
    }
  }

  async function handleConfirm() {
    if (!photo?.base64) return;
    setSubmitting(true); setSubmitError('');
    try {
      const res = await fetch(API_ENDPOINTS.faceRequest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photo: photo.base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal mengirim permintaan.');
      setMode('idle');
      setPhoto(null);
      await fetchStatus();
    } catch (e: any) {
      setSubmitError(e.message ?? 'Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Fullscreen camera ──────────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <View style={styles.flex}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView ref={cameraRef} style={styles.flex} facing="front" />
        <OvalCameraOverlay screenWidth={SW} screenHeight={SH} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMode('idle')}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Foto Wajah Baru</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          {submitError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
              <Text style={styles.errorBoxText}>{submitError}</Text>
            </View>
          ) : null}
          <TouchableOpacity onPress={handleCapture} activeOpacity={0.85}>
            <View style={styles.captureRing}>
              <View style={styles.captureInner} />
            </View>
          </TouchableOpacity>
          <Text style={styles.captureLabel}>Ambil Foto</Text>
        </View>
      </View>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (mode === 'preview' && photo) {
    return (
      <View style={styles.flex}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <Image source={{ uri: photo.uri }} style={styles.flex} resizeMode="cover" />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.topBarTitle}>Konfirmasi Foto</Text>
        </View>
        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          {submitError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
              <Text style={styles.errorBoxText}>{submitError}</Text>
            </View>
          ) : null}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => { setPhoto(null); setMode('camera'); setSubmitError(''); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
              <Text style={styles.retakeBtnText}>Ulangi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <><ActivityIndicator color="#fff" size="small" /><Text style={styles.confirmBtnText}>Mengirim...</Text></>
              ) : (
                <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.confirmBtnText}>Kirim Permintaan</Text></>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Idle: status + action ────────────────────────────────────────────────
  const hasPending = status?.status === 'pending';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ganti Foto Wajah</Text>
          <View style={{ width: 38 }} />
        </View>
      </View>

      <View style={styles.content}>
        {loadingStatus ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : statusError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={DANGER} />
            <Text style={styles.errorCardText}>{statusError}</Text>
          </View>
        ) : (
          <>
            {status && (
              <StatusCard status={status} />
            )}

            {!status && (
              <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={16} color="#0891B2" />
                <Text style={styles.infoNoteText}>
                  Belum pernah mengajukan permintaan ganti foto wajah.
                </Text>
              </View>
            )}

            <View style={styles.ruleNote}>
              <Ionicons name="alert-circle-outline" size={16} color={WARNING} />
              <Text style={styles.ruleNoteText}>
                Foto wajah baru menunggu persetujuan admin sebelum digunakan. Hanya boleh ada 1 permintaan pending pada satu waktu.
              </Text>
            </View>

            {submitError ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color={DANGER} />
                <Text style={styles.errorCardText}>{submitError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.actionBtn, hasPending && styles.actionBtnDisabled]}
              onPress={handleOpenCamera}
              disabled={hasPending}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>
                {hasPending ? 'Menunggu Persetujuan Admin' : 'Ajukan Foto Wajah Baru'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function StatusCard({ status }: { status: NonNullable<FaceRequestStatus> }) {
  const cfg = {
    pending:  { label: 'Menunggu Persetujuan', color: WARNING, bg: '#FFFBEB', icon: 'time-outline' as const },
    approved: { label: 'Disetujui',             color: SUCCESS, bg: '#F0FDF4', icon: 'checkmark-circle-outline' as const },
    rejected: { label: 'Ditolak',                color: DANGER,  bg: '#FEF2F2', icon: 'close-circle-outline' as const },
  }[status.status];

  return (
    <View style={[styles.statusCard, { backgroundColor: cfg.bg }]}>
      <View style={styles.statusCardTop}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        <Text style={[styles.statusCardTitle, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <Text style={styles.statusCardDate}>
        Diajukan {new Date(status.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>
      {status.status === 'rejected' && status.rejection_reason && (
        <View style={styles.statusReasonBox}>
          <Text style={styles.statusReasonLabel}>Alasan ditolak:</Text>
          <Text style={styles.statusReasonText}>{status.rejection_reason}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  header: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 20 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  content: { padding: 16, gap: 14 },
  centerBox: { alignItems: 'center', paddingTop: 48 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorCardText: { flex: 1, fontSize: 13, color: DANGER, fontWeight: '500' },

  statusCard: { borderRadius: 16, padding: 16, gap: 8 },
  statusCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusCardTitle: { fontSize: 16, fontWeight: '700' },
  statusCardDate: { fontSize: 12, color: '#64748B' },
  statusReasonBox: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginTop: 4 },
  statusReasonLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  statusReasonText: { fontSize: 13, color: '#1E293B', marginTop: 2, lineHeight: 18 },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#ECFEFF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#A5F3FC',
  },
  infoNoteText: { flex: 1, fontSize: 12, color: '#0E7490', lineHeight: 17 },

  ruleNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  ruleNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  actionBtn: {
    backgroundColor: PRIMARY, borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  actionBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Camera UI
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 24, paddingHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', gap: 10,
  },
  captureRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  captureLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 10, padding: 10, width: '100%',
  },
  errorBoxText: { flex: 1, color: '#FCA5A5', fontSize: 12 },

  previewActions: { flexDirection: 'row', gap: 12, width: '100%' },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 14, height: 52,
  },
  retakeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: SUCCESS, borderRadius: 14, height: 52,
    shadowColor: SUCCESS, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
