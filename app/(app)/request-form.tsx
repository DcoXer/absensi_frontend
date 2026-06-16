import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, CameraCapturedPicture, useCameraPermissions } from 'expo-camera';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';
import OvalCameraOverlay from '@/components/OvalCameraOverlay';
import CalendarPicker from '@/components/CalendarPicker';

const PRIMARY  = '#1565C0';
const SUCCESS  = '#16A34A';
const WARNING  = '#D97706';
const DANGER   = '#DC2626';
const PURPLE   = '#7C3AED';
const CYAN     = '#0891B2';

type RequestType = 'cuti' | 'izin' | 'sakit' | 'lembur';

const TYPES: {
  key: RequestType; label: string; desc: string;
  icon: keyof typeof Ionicons.glyphMap; color: string; bg: string;
}[] = [
  { key: 'cuti',   label: 'Cuti',   desc: 'Cuti tahunan',       icon: 'umbrella-outline',  color: PURPLE, bg: '#F5F3FF' },
  { key: 'izin',   label: 'Izin',   desc: 'Izin keperluan',     icon: 'hand-left-outline', color: CYAN,   bg: '#ECFEFF' },
  { key: 'sakit',  label: 'Sakit',  desc: 'Butuh surat dokter', icon: 'medical-outline',   color: DANGER, bg: '#FEF2F2' },
  { key: 'lembur', label: 'Lembur', desc: 'Kerja di luar jam',  icon: 'time-outline',      color: WARNING,bg: '#FFFBEB' },
];

export default function RequestFormScreen() {
  const { token } = useAuth();
  const insets    = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const cameraRef = useRef<CameraView>(null);

  const [type, setType]           = useState<RequestType | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [reason, setReason]       = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  // Lembur: start_photo wajib live capture (diverifikasi ke wajah referensi), beda dari
  // attachment surat sakit yang boleh dari galeri.
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [startPhoto, setStartPhoto] = useState<CameraCapturedPicture | null>(null);
  const [cameraError, setCameraError] = useState('');

  const selected = TYPES.find(t => t.key === type);
  const accentColor = selected?.color ?? PRIMARY;

  // Each "Jenis Pengajuan" tab is conceptually its own form — switching tabs
  // shouldn't carry over a previous tab's date/time/reason/attachment.
  function handleSelectType(key: RequestType) {
    setType(key);
    setError('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setAttachment(null);
    setStartPhoto(null);
  }

  async function pickAttachment() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Izin galeri ditolak'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.6,
      mediaTypes: 'images',
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAttachment(result.assets[0].base64);
    }
  }

  async function handleOpenCamera() {
    setCameraError('');
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) { setCameraError('Izin kamera ditolak.'); return; }
    }
    setCameraOpen(true);
  }

  async function handleCaptureStartPhoto() {
    if (!cameraRef.current) return;
    setCameraError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.7, imageType: 'jpg',
      });
      if (!captured) throw new Error('Foto tidak berhasil diambil.');
      setStartPhoto(captured);
      setCameraOpen(false);
    } catch (e: any) {
      setCameraError(e.message ?? 'Gagal mengambil foto.');
    }
  }

  async function handleSubmit() {
    if (!type) { setError('Pilih jenis pengajuan.'); return; }
    if (!reason.trim()) { setError('Alasan wajib diisi.'); return; }
    // Lembur: tanggal & waktu dicatat otomatis oleh backend dari started_at/ended_at —
    // client tidak boleh mengasumsikan/mengirim nilainya sendiri (zero-trust).
    if (type !== 'lembur' && !startDate) { setError('Tanggal mulai wajib diisi.'); return; }
    if (type === 'lembur' && !startPhoto?.base64) {
      setError('Selfie mulai lembur wajib diambil.'); return;
    }
    if (type === 'sakit' && !attachment) {
      setError('Foto surat dokter wajib dilampirkan.'); return;
    }

    setError(''); setSubmitting(true);
    try {
      const body: Record<string, any> = { type, reason };
      if (type === 'lembur') {
        body.start_photo = startPhoto!.base64;
      } else {
        body.start_date = startDate;
        if (endDate) body.end_date = endDate;
      }
      if (type === 'sakit' && attachment) body.attachment = attachment;

      const res = await fetch(API_ENDPOINTS.requests, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) { setError(json.message ?? 'Gagal mengirim pengajuan.'); return; }

      Alert.alert('Berhasil', json.message ?? 'Pengajuan berhasil dikirim.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Fullscreen camera (selfie mulai lembur) ─────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraFlex}>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView ref={cameraRef} style={styles.cameraFlex} facing="front" />
        <OvalCameraOverlay screenWidth={SW} screenHeight={SH} />

        <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.camBackBtn} onPress={() => setCameraOpen(false)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.camTopTitle}>Selfie Mulai Lembur</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.cameraControls, { paddingBottom: insets.bottom + 28 }]}>
          {cameraError ? (
            <View style={styles.cameraErrorBox}>
              <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
              <Text style={styles.cameraErrorText}>{cameraError}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.captureBtn} onPress={handleCaptureStartPhoto} activeOpacity={0.85}>
            <View style={styles.captureRing}>
              <View style={styles.captureInner} />
            </View>
          </TouchableOpacity>
          <Text style={styles.captureBtnLabel}>Ambil Foto</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: accentColor }]}>
          <View style={styles.headerNav}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Buat Pengajuan</Text>
            <View style={{ width: 38 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Jenis Pengajuan</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.typeCard,
                    { borderColor: type === t.key ? t.color : '#E2E8F0' },
                    type === t.key && { backgroundColor: t.bg },
                  ]}
                  onPress={() => handleSelectType(t.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.typeIcon, { backgroundColor: type === t.key ? t.bg : '#F8FAFC' }]}>
                    <Ionicons name={t.icon} size={22} color={type === t.key ? t.color : '#94A3B8'} />
                  </View>
                  <Text style={[styles.typeLabel, type === t.key && { color: t.color }]}>{t.label}</Text>
                  <Text style={styles.typeDesc}>{t.desc}</Text>
                  {type === t.key && (
                    <View style={[styles.typeCheck, { backgroundColor: t.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date fields — tidak berlaku untuk lembur (tanggal & waktu dicatat otomatis backend) */}
          {type && type !== 'lembur' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tanggal</Text>
              <View style={styles.card}>
                <DateField
                  label="Tanggal Mulai"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                  minimumDate={new Date()}
                />
                {(type === 'cuti' || type === 'sakit') && (
                  <>
                    <Divider />
                    <DateField
                      label="Tanggal Selesai"
                      placeholder="YYYY-MM-DD (opsional)"
                      value={endDate}
                      onChangeText={setEndDate}
                      minimumDate={parseISODate(startDate) ?? new Date()}
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {type === 'lembur' && (
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={WARNING} />
              <Text style={styles.infoNoteText}>
                Tanggal & waktu mulai lembur dicatat otomatis saat selfie diverifikasi. Tidak perlu input manual.
              </Text>
            </View>
          )}

          {/* Reason */}
          {type && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Alasan</Text>
              <View style={styles.card}>
                <TextInput
                  style={styles.textarea}
                  placeholder="Jelaskan alasan pengajuan..."
                  placeholderTextColor="#CBD5E1"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {/* Attachment (sakit only) */}
          {type === 'sakit' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Surat Dokter <Text style={styles.required}>*Wajib</Text></Text>
              <TouchableOpacity
                style={[styles.attachBtn, attachment && styles.attachBtnDone]}
                onPress={pickAttachment}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={attachment ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={24}
                  color={attachment ? SUCCESS : '#94A3B8'}
                />
                <Text style={[styles.attachText, attachment && { color: SUCCESS }]}>
                  {attachment ? 'Foto terlampir' : 'Pilih foto dari galeri'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Selfie mulai lembur (lembur only) — live capture, diverifikasi ke wajah referensi */}
          {type === 'lembur' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Selfie Mulai Lembur <Text style={styles.required}>*Wajib</Text></Text>
              {startPhoto ? (
                <TouchableOpacity style={styles.startPhotoPreview} onPress={handleOpenCamera} activeOpacity={0.85}>
                  <Image source={{ uri: startPhoto.uri }} style={styles.startPhotoImg} resizeMode="cover" />
                  <View style={styles.startPhotoBadge}>
                    <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />
                  </View>
                  <View style={styles.startPhotoRetake}>
                    <Ionicons name="camera-reverse-outline" size={14} color="#fff" />
                    <Text style={styles.startPhotoRetakeText}>Ambil Ulang</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={handleOpenCamera} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                  <Text style={styles.attachText}>Buka kamera & ambil selfie</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={DANGER} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          {type && (
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: accentColor }, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.submitText}>Kirim Pengajuan</Text></>
              }
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <View style={styles.divider} />;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Date field that can be typed manually (YYYY-MM-DD) or filled via a custom
 * calendar dropdown (consistent look on Android & iOS, no OS-theme contrast
 * issues like the native picker had).
 */
function DateField({
  label, placeholder, value, onChangeText, minimumDate,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void;
  minimumDate?: Date;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedDate = parseISODate(value);

  return (
    <View style={styles.fieldRow}>
      <TouchableOpacity style={styles.fieldIconWrap} onPress={() => setPickerOpen(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
      </TouchableOpacity>
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor="#CBD5E1"
          value={value}
          onChangeText={onChangeText}
        />
      </View>

      <CalendarPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={selectedDate}
        minimumDate={minimumDate}
        title={label}
        onSelect={(date) => { onChangeText(toISODate(date)); setPickerOpen(false); }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  content: { padding: 16, gap: 20 },

  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  required: { color: DANGER, textTransform: 'none' },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  infoNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '47%', backgroundColor: '#fff',
    borderRadius: 16, padding: 14,
    borderWidth: 2, borderColor: '#E2E8F0', gap: 6,
    position: 'relative',
  },
  typeIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  typeDesc:  { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  typeCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

  // Field
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  fieldIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  fieldInput: { fontSize: 14, fontWeight: '600', color: '#1E293B', padding: 0 },

  // Textarea
  textarea: {
    padding: 16, fontSize: 14, color: '#1E293B',
    minHeight: 100, lineHeight: 20,
  },

  // Attachment
  attachBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    padding: 24, alignItems: 'center', gap: 8,
  },
  attachBtnDone: { borderColor: SUCCESS, borderStyle: 'solid', backgroundColor: '#F0FDF4' },
  attachText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: DANGER, fontWeight: '500' },

  // Submit
  submitBtn: {
    borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Start-photo (lembur) preview
  startPhotoPreview: {
    height: 180, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: SUCCESS,
  },
  startPhotoImg: { width: '100%', height: '100%' },
  startPhotoBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 2,
  },
  startPhotoRetake: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 8,
  },
  startPhotoRetakeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Fullscreen camera (selfie mulai lembur)
  cameraFlex: { flex: 1, backgroundColor: '#000' },
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  camBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  camTopTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cameraControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 24, paddingHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', gap: 10,
  },
  captureBtn: {},
  captureRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  captureBtnLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  cameraErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: 10, padding: 10, width: '100%',
  },
  cameraErrorText: { flex: 1, color: '#FCA5A5', fontSize: 12 },
});
