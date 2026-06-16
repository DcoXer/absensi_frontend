import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_ENDPOINTS } from '@/constants/api';

const CIRCLE_SIZE = 264;
const PRIMARY = '#1565C0';
const SUCCESS = '#16A34A';

export default function FaceScanScreen() {
  const { employee_id } = useLocalSearchParams<{ employee_id: string }>();
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'preview'>('camera');
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCapture() {
    if (!cameraRef.current) return;
    setError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!captured) throw new Error('Foto tidak berhasil diambil.');
      setPhoto(captured);
      setMode('preview');
    } catch (e: any) {
      setError(e.message ?? 'Gagal mengambil foto. Coba lagi.');
    }
  }

  async function handleConfirm() {
    if (!photo?.base64) {
      setError('Data foto tidak tersedia. Coba ambil ulang.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_ENDPOINTS.uploadFace, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Spec (API.md §1 Register Face) only accepts employee_id + photo.
        body: JSON.stringify({ employee_id, photo: photo.base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Upload wajah gagal.');
      Alert.alert(
        'Registrasi Berhasil',
        'Registrasi lengkap, tunggu persetujuan admin',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRetake() {
    setPhoto(null);
    setMode('camera');
    setError('');
  }

  // ── Permission loading ────────────────────────────────────────────────────
  if (!permission) return <View style={styles.flex} />;

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    const isPermanentlyDenied = !permission.canAskAgain;
    return (
      <View style={[styles.permissionRoot, { paddingTop: insets.top }]}>

        {/* Back button */}
        <TouchableOpacity style={styles.permissionBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#64748B" />
        </TouchableOpacity>

        {/* Illustration */}
        <View style={styles.permissionIllustration}>
          <View style={styles.permissionOuterRing}>
            <View style={styles.permissionInnerRing}>
              <View style={styles.permissionIconCircle}>
                <Ionicons name="camera" size={36} color={PRIMARY} />
              </View>
            </View>
          </View>
          {/* Blocked badge */}
          <View style={styles.permissionBlockedBadge}>
            <Ionicons name="close" size={12} color="#fff" />
          </View>
        </View>

        {/* Text */}
        <Text style={styles.permissionTitle}>
          {isPermanentlyDenied ? 'Akses Kamera Diblokir' : 'Izin Kamera Diperlukan'}
        </Text>
        <Text style={styles.permissionSubtitle}>
          {isPermanentlyDenied
            ? 'Anda telah menolak izin kamera secara permanen. Aktifkan secara manual di pengaturan perangkat.'
            : 'AbsensiApp membutuhkan akses kamera untuk mendaftarkan wajah Anda.'}
        </Text>

        {/* Reason chips */}
        <View style={styles.permissionReasons}>
          {[
            { icon: 'scan-outline' as const, text: 'Scan & daftarkan wajah' },
            { icon: 'shield-checkmark-outline' as const, text: 'Verifikasi kehadiran' },
            { icon: 'lock-closed-outline' as const, text: 'Data tidak disimpan di luar server' },
          ].map((item) => (
            <View key={item.text} style={styles.permissionReasonChip}>
              <Ionicons name={item.icon} size={15} color={PRIMARY} />
              <Text style={styles.permissionReasonText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        {isPermanentlyDenied ? (
          <>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.85}
            >
              <Ionicons name="settings-outline" size={18} color="#fff" />
              <Text style={styles.permissionBtnText}>Buka Pengaturan</Text>
            </TouchableOpacity>
            <Text style={styles.permissionSettingsHint}>
              Pengaturan → Privasi → Kamera → AbsensiApp → Izinkan
            </Text>
          </>
        ) : (
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.permissionBtnText}>Izinkan Akses Kamera</Text>
          </TouchableOpacity>
        )}

      </View>
    );
  }

  const circleTop = (SH - CIRCLE_SIZE) / 2;
  const circleLeft = (SW - CIRCLE_SIZE) / 2;

  return (
    <View style={styles.flex}>

      {/* ── Camera / Preview fill ── */}
      {mode === 'camera' ? (
        <CameraView ref={cameraRef} style={styles.flex} facing="front" />
      ) : (
        <Image source={{ uri: photo!.uri }} style={styles.flex} resizeMode="cover" />
      )}

      {/* ── Dark overlay with circle cutout ── */}
      <CircleOverlay
        screenWidth={SW}
        screenHeight={SH}
        borderColor={mode === 'preview' ? SUCCESS : '#fff'}
        animated={mode === 'camera'}
      />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarStep}>
          <View style={styles.stepDot} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <Text style={styles.topBarTitle}>
          {mode === 'camera' ? 'Daftar Wajah' : 'Konfirmasi Foto'}
        </Text>
        <Text style={styles.topBarSub}>Langkah 2 dari 2</Text>
      </View>

      {/* ── Instruction pill above circle ── */}
      <View
        style={[styles.instructionWrap, { top: circleTop - 52 }]}
        pointerEvents="none"
      >
        <View style={styles.instructionPill}>
          <Ionicons
            name={mode === 'camera' ? 'scan-outline' : 'checkmark-circle-outline'}
            size={14}
            color="#fff"
          />
          <Text style={styles.instructionText}>
            {mode === 'camera'
              ? 'Posisikan wajah di dalam lingkaran'
              : 'Pastikan wajah terlihat jelas'}
          </Text>
        </View>
      </View>

      {/* ── Corner markers on the circle ── */}
      {mode === 'camera' && (
        <View
          style={[styles.cornerMarkers, {
            top: circleTop,
            left: circleLeft,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
          }]}
          pointerEvents="none"
        >
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      )}

      {/* ── Bottom controls ── */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {mode === 'camera' ? (
          /* Shutter button */
          <View style={styles.shutterRow}>
            <View style={styles.shutterSide} />
            <TouchableOpacity onPress={handleCapture} activeOpacity={0.8} style={styles.shutterBtn}>
              <View style={styles.shutterRing}>
                <View style={styles.shutterInner} />
              </View>
            </TouchableOpacity>
            <View style={styles.shutterSide} />
          </View>
        ) : (
          /* Preview action row */
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
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
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.confirmBtnText}>Mengunggah...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>Gunakan Foto</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hint}>
          {mode === 'camera'
            ? 'Pastikan pencahayaan cukup dan wajah tidak tertutup'
            : 'Foto akan digunakan untuk verifikasi kehadiran'}
        </Text>
      </View>
    </View>
  );
}

// ── Circle overlay ────────────────────────────────────────────────────────────

function CircleOverlay({
  screenWidth, screenHeight, borderColor, animated,
}: {
  screenWidth: number;
  screenHeight: number;
  borderColor: string;
  animated: boolean;
}) {
  const left = (screenWidth - CIRCLE_SIZE) / 2;
  const top = (screenHeight - CIRCLE_SIZE) / 2;
  const OVERLAY = 'rgba(0,0,0,0.62)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ height: top, backgroundColor: OVERLAY }} />
      <View style={{ flexDirection: 'row', height: CIRCLE_SIZE }}>
        <View style={{ width: left, backgroundColor: OVERLAY }} />
        <View style={[overlayStyles.circle, { borderColor, borderWidth: animated ? 2.5 : 3.5 }]} />
        <View style={{ flex: 1, backgroundColor: OVERLAY }} />
      </View>
      <View style={{ flex: 1, backgroundColor: OVERLAY }} />
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },

  // Permission screen
  permissionRoot: {
    flex: 1,
    backgroundColor: '#EFF3FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  permissionBack: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  permissionIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionInnerRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBlockedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#EFF3FB',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionReasons: {
    width: '100%',
    gap: 8,
    marginVertical: 4,
  },
  permissionReasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  permissionReasonText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 15,
    marginTop: 4,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  permissionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  permissionSettingsHint: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 4,
  },
  topBarStep: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotActive: { backgroundColor: '#fff', width: 18 },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topBarSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Instruction
  instructionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // Corner markers
  cornerMarkers: { position: 'absolute' },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  cornerTL: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  // Bottom controls panel
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 14,
    alignItems: 'center',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.4)',
    borderRadius: 10,
    padding: 10,
    width: '100%',
  },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 13 },

  // Shutter
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  shutterSide: { flex: 1 },
  shutterBtn: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },

  // Preview actions
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    height: 52,
  },
  retakeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SUCCESS,
    borderRadius: 14,
    height: 52,
    shadowColor: SUCCESS,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Hint
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
