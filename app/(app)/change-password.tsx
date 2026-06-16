import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';

const PRIMARY = '#1565C0';

export default function ChangePasswordScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit() {
    if (!currentPassword || !password || !passwordConfirmation) {
      setError('Semua field wajib diisi.'); return;
    }
    if (password !== passwordConfirmation) {
      setError('Konfirmasi password tidak cocok.'); return;
    }
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const res = await fetch(API_ENDPOINTS.profilePassword, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: currentPassword,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Gagal mengganti password.');

      setCurrentPassword(''); setPassword(''); setPasswordConfirmation('');
      setSuccess(json.message ?? 'Password berhasil diperbarui.');
    } catch (e: any) {
      setError(e.message ?? 'Terjadi kesalahan koneksi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ganti Password</Text>
          <View style={{ width: 38 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {success ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <PasswordField
            label="Password Lama"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            visible={showCurrent}
            onToggle={() => setShowCurrent(v => !v)}
          />
          <Divider />
          <PasswordField
            label="Password Baru"
            value={password}
            onChangeText={setPassword}
            visible={showNew}
            onToggle={() => setShowNew(v => !v)}
            placeholder="Minimal 8 karakter"
          />
          <Divider />
          <PasswordField
            label="Konfirmasi Password Baru"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            visible={showNew}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={styles.submitText}>Simpan Password Baru</Text></>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordField({
  label, value, onChangeText, visible, onToggle, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggle?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconWrap}>
        <Ionicons name="lock-closed-outline" size={16} color={PRIMARY} />
      </View>
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder ?? 'Masukkan password'}
          placeholderTextColor="#CBD5E1"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
        />
      </View>
      {onToggle && (
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  header: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingBottom: 20 },
  headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  content: { padding: 16, gap: 16 },

  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#BBF7D0',
  },
  successText: { flex: 1, fontSize: 13, color: '#15803D', fontWeight: '500' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  fieldIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  fieldInput: { fontSize: 14, fontWeight: '600', color: '#1E293B', padding: 0 },
  eyeBtn: { padding: 4 },

  submitBtn: {
    backgroundColor: PRIMARY, borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
