import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

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

  const [type, setType]           = useState<RequestType | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [reason, setReason]       = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const selected = TYPES.find(t => t.key === type);
  const accentColor = selected?.color ?? PRIMARY;

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

  async function handleSubmit() {
    if (!type) { setError('Pilih jenis pengajuan.'); return; }
    if (!startDate) { setError('Tanggal mulai wajib diisi.'); return; }
    if (!reason.trim()) { setError('Alasan wajib diisi.'); return; }
    if (type === 'lembur' && (!startTime || !endTime)) {
      setError('Jam mulai dan selesai wajib diisi untuk lembur.'); return;
    }
    if (type === 'sakit' && !attachment) {
      setError('Foto surat dokter wajib dilampirkan.'); return;
    }

    setError(''); setSubmitting(true);
    try {
      const body: Record<string, any> = { type, start_date: startDate, reason };
      if (endDate) body.end_date = endDate;
      if (type === 'lembur') { body.start_time = startTime; body.end_time = endTime; }
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
                  onPress={() => { setType(t.key); setError(''); }}
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

          {/* Date fields */}
          {type && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tanggal</Text>
              <View style={styles.card}>
                <Field
                  label="Tanggal Mulai"
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                  icon="calendar-outline"
                />
                {(type === 'cuti' || type === 'sakit') && (
                  <>
                    <Divider />
                    <Field
                      label="Tanggal Selesai"
                      placeholder="YYYY-MM-DD (opsional)"
                      value={endDate}
                      onChangeText={setEndDate}
                      icon="calendar-outline"
                    />
                  </>
                )}
                {type === 'lembur' && (
                  <>
                    <Divider />
                    <Field
                      label="Jam Mulai"
                      placeholder="18:00"
                      value={startTime}
                      onChangeText={setStartTime}
                      icon="time-outline"
                    />
                    <Divider />
                    <Field
                      label="Jam Selesai"
                      placeholder="21:00"
                      value={endTime}
                      onChangeText={setEndTime}
                      icon="time-outline"
                    />
                  </>
                )}
              </View>
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

function Field({
  label, placeholder, value, onChangeText, icon,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconWrap}>
        <Ionicons name={icon} size={16} color={PRIMARY} />
      </View>
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
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
});
