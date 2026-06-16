import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';
import OvalCameraOverlay from '@/components/OvalCameraOverlay';

const PRIMARY = '#1565C0';
const SUCCESS = '#16A34A';

export default function LemburEndScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [step, setStep] = useState<'camera' | 'preview' | 'done'>('camera');
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ensurePermission() {
    if (cameraPermission?.granted) return true;
    const { granted } = await requestCameraPermission();
    if (!granted) setError('Izin kamera ditolak. Aktifkan di pengaturan.');
    return granted;
  }

  async function handleCapture() {
    if (!(await ensurePermission()) || !cameraRef.current) return;
    setError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.7, imageType: 'jpg',
      });
      if (!captured) throw new Error('Foto tidak berhasil diambil.');
      setPhoto(captured);
      setStep('preview');
    } catch (e: any) {
      setError(e.message ?? 'Gagal mengambil foto.');
    }
  }

  async function handleConfirm() {
    if (!photo?.base64 || !id) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(API_ENDPOINTS.requestEnd(Number(id)), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ end_photo: photo.base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal menandai lembur selesai.');
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Permission gate ───────────────────────────────────────────────────────
  if (!cameraPermission) return <View style={styles.flex} />;

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <View style={styles.doneRoot}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.doneHero, { paddingTop: insets.top + 40 }]}>
          <View style={styles.doneIconCircle}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.doneTitle}>Lembur Selesai Dicatat</Text>
          <Text style={styles.doneSub}>Terima kasih sudah lembur hari ini</Text>
        </View>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace('/(app)/(tabs)/requests')}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.doneBtnText}>Kembali ke Pengajuan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === 'preview' && photo) {
    return (
      <View style={styles.flex}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <Image source={{ uri: photo.uri }} style={styles.flex} resizeMode="cover" />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.topBarTitle}>Konfirmasi Foto</Text>
        </View>
        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => { setPhoto(null); setStep('camera'); setError(''); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
              <Text style={styles.retakeBtnText}>Ulangi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <><ActivityIndicator color="#fff" size="small" /><Text style={styles.confirmBtnText}>Mengirim...</Text></>
              ) : (
                <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.confirmBtnText}>Selesaikan Lembur</Text></>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={cameraRef} style={styles.flex} facing="front" />
      <OvalCameraOverlay screenWidth={SW} screenHeight={SH} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Selfie Selesai Lembur</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={styles.errorText}>{error}</Text>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 10, padding: 10, width: '100%',
  },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 13 },

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

  // Done screen
  doneRoot: { flex: 1, backgroundColor: '#F0F4FF', justifyContent: 'space-between' },
  doneHero: { alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  doneIconCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: SUCCESS, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  doneTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  doneSub: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 16, height: 54, margin: 20,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
