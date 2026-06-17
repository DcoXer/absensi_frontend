import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { CameraView, CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS } from '@/constants/api';
import OvalCameraOverlay from '@/components/OvalCameraOverlay';

const ACCURACY_THRESHOLD = 50;
const PRIMARY = '#1565C0';
const SUCCESS = '#16A34A';
const WARNING = '#D97706';

type GPSResult = { lat: number; lng: number; accuracy: number };
type OfficeLocation = {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: number;
  is_active: boolean;
};

export default function CheckInScreen() {
  const { token } = useAuth();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isCheckOut = type === 'check_out';
  const ACCENT = isCheckOut ? WARNING : PRIMARY;

  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<'gps' | 'face' | 'done'>('gps');

  // Office location — fetched on mount, required before submit
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationFetchError, setLocationFetchError] = useState('');

  const [gps, setGps]             = useState<GPSResult | null>(null);
  const [gpsWarning, setGpsWarning] = useState('');
  const [gpsValid, setGpsValid]   = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError]   = useState('');

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen]   = useState(false);
  const [selfiePhoto, setSelfiePhoto] = useState<CameraCapturedPicture | null>(null);
  const [cameraError, setCameraError] = useState('');

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submitError, setSubmitError]     = useState('');
  // Diisi dari server response (created_at), bukan device time.
  const [doneTime, setDoneTime]   = useState('');
  const [doneDate, setDoneDate]   = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') setGpsError('Izin lokasi ditolak. Aktifkan di pengaturan.');
    })();
  }, []);

  // Fetch active office locations — required before submitting check-in/out.
  async function fetchOfficeLocations() {
    setLoadingLocations(true);
    setLocationFetchError('');
    try {
      const res = await fetch(API_ENDPOINTS.officeLocations, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      // Handle both array response dan paginated (json.data.data)
      const raw = Array.isArray(json.data) ? json.data
        : Array.isArray(json.data?.data) ? json.data.data
        : [];
      const locations: OfficeLocation[] = raw;
      // is_active bisa boolean true atau integer 1 dari MySQL
      const active = locations.find(l => !!l.is_active) ?? locations[0] ?? null;
      setOfficeLocation(active);
      if (!active) setLocationFetchError('Tidak ada lokasi kantor aktif. Hubungi admin.');
    } catch {
      setLocationFetchError('Gagal memuat lokasi kantor. Coba lagi.');
    } finally {
      setLoadingLocations(false);
    }
  }

  useEffect(() => { fetchOfficeLocations(); }, [token]);

  async function handleGetLocation() {
    setLoadingGps(true);
    setGpsError(''); setGpsWarning(''); setGps(null); setGpsValid(false);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Izin lokasi ditolak. Aktifkan di pengaturan.');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (Platform.OS === 'android' && loc.mocked)
        throw new Error('Fake GPS terdeteksi. Nonaktifkan mock location.');
      const accuracy = loc.coords.accuracy ?? Infinity;
      setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy });
      accuracy > ACCURACY_THRESHOLD ? setGpsWarning('Sinyal GPS lemah, coba di tempat terbuka') : setGpsValid(true);
    } catch (e: any) {
      setGpsError(e.message);
    } finally {
      setLoadingGps(false);
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

  async function handleCaptureSelfie() {
    if (!cameraRef.current) return;
    setCameraError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({
        base64: true, quality: 0.7, imageType: 'jpg',
      });
      if (!captured) throw new Error('Foto tidak berhasil diambil.');
      setSelfiePhoto(captured);
      setCameraOpen(false);
    } catch (e: any) {
      setCameraError(e.message ?? 'Gagal mengambil foto.');
    }
  }

  async function handleSubmit() {
    if (!gps || !selfiePhoto?.base64 || !officeLocation) return;
    setLoadingSubmit(true); setSubmitError('');
    try {
      console.log('[CheckIn] Starting submission');
      const base64 = selfiePhoto.base64;
      console.log(`[CheckIn] Photo size: ${base64?.length ?? 0} chars`);

      const payload = JSON.stringify({
        office_location_id: officeLocation.id,
        latitude: gps.lat,
        longitude: gps.lng,
        photo: base64,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const endpoint = isCheckOut ? API_ENDPOINTS.checkOut : API_ENDPOINTS.checkIn;
      console.log('[CheckIn] Sending to API:', endpoint);

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: payload, signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }

      console.log(`[CheckIn] Response received — status: ${res.status}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? 'Absensi gagal.');
      }
      // Zero-trust: gunakan timestamp dari server (created_at), bukan jam device.
      const serverTs = json.data?.created_at ? new Date(json.data.created_at) : new Date();
      setDoneTime(serverTs.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setDoneDate(serverTs.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }));
      setStep('done');
    } catch (e: any) {
      console.log('[CheckIn] Error name:', e.name);
      console.log('[CheckIn] Error message:', e.message);
      setSubmitError(e.name === 'AbortError' ? 'Request timeout. Periksa koneksi.' : e.message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  // ── Fullscreen camera ──────────────────────────────────────────────────────
  if (step === 'face' && cameraOpen) {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ headerShown: false }} />
        <CameraView ref={cameraRef} style={styles.flex} facing="front" />
        <OvalCameraOverlay screenWidth={SW} screenHeight={SH} />

        {/* Top bar */}
        <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.camBackBtn} onPress={() => setCameraOpen(false)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.camTopTitle}>Foto Selfie</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Instruction */}
        <View style={[styles.instructionBanner, { top: (SH - 320) / 2 - 56 }]} pointerEvents="none">
          <Text style={styles.instructionText}>Posisikan wajah di dalam oval</Text>
        </View>

        {/* Bottom controls */}
        <View style={[styles.cameraControls, { paddingBottom: insets.bottom + 28 }]}>
          {cameraError ? (
            <View style={styles.cameraErrorBox}>
              <Ionicons name="alert-circle" size={14} color="#FCA5A5" />
              <Text style={styles.cameraErrorText}>{cameraError}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.captureBtn} onPress={handleCaptureSelfie} activeOpacity={0.85}>
            <View style={styles.captureRing}>
              <View style={styles.captureInner} />
            </View>
          </TouchableOpacity>
          <Text style={styles.captureBtnLabel}>Ambil Foto</Text>
        </View>
      </View>
    );
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (step === 'done') {
    const doneColor  = isCheckOut ? WARNING : SUCCESS;
    const dateStr = doneDate;

    return (
      <View style={styles.doneRoot}>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />

        {/* Colored top half */}
        <View style={[styles.doneHero, { backgroundColor: doneColor, paddingTop: insets.top + 32 }]}>

          {/* Rings + checkmark */}
          <View style={styles.doneIconWrap}>
            <View style={[styles.doneRingOuter, { borderColor: 'rgba(255,255,255,0.25)' }]}>
              <View style={[styles.doneRingInner, { borderColor: 'rgba(255,255,255,0.4)' }]}>
                <View style={styles.doneCheckCircle}>
                  <Ionicons name="checkmark" size={40} color={doneColor} />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.doneHeroTitle}>
            {isCheckOut ? 'Pulang Tercatat!' : 'Absensi Berhasil!'}
          </Text>
          <View style={styles.doneHeroSubRow}>
            <Ionicons
              name={isCheckOut ? 'moon-outline' : 'sunny-outline'}
              size={14}
              color="rgba(255,255,255,0.85)"
            />
            <Text style={styles.doneHeroSub}>
              {isCheckOut ? 'Selamat beristirahat' : 'Selamat bekerja hari ini'}
            </Text>
          </View>
        </View>

        {/* Info section */}
        <View style={styles.doneBody}>
          {/* Time highlight */}
          <View style={[styles.doneTimeChip, { borderColor: doneColor }]}>
            <Ionicons name="time" size={16} color={doneColor} />
            <Text style={[styles.doneTimeValue, { color: doneColor }]}>{doneTime} WIB</Text>
            <View style={[styles.doneTimeBadge, { backgroundColor: doneColor }]}>
              <Text style={styles.doneTimeBadgeText}>
                {isCheckOut ? 'Pulang' : 'Masuk'}
              </Text>
            </View>
          </View>

          {/* Detail card */}
          <View style={styles.doneInfoCard}>
            <DoneRow icon="calendar-outline" label="Tanggal" value={dateStr} />
            <View style={styles.doneInfoDivider} />
            <DoneRow icon="location-outline" label="Lokasi" value={officeLocation?.name ?? 'Kantor'} />
            <View style={styles.doneInfoDivider} />
            <DoneRow
              icon={isCheckOut ? 'log-out-outline' : 'log-in-outline'}
              label="Tipe Absen"
              value={isCheckOut ? 'Absen Pulang' : 'Absen Masuk'}
              valueColor={doneColor}
            />
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: doneColor }]}
            onPress={() => router.replace('/(app)')}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Kembali ke Beranda</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step layout ────────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>

        {/* ── Hero header ── */}
        <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
          {/* Nav row */}
          <View style={styles.heroNav}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>
              {isCheckOut ? 'Absen Pulang' : 'Absen Masuk'}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <StepPill num={1} label="Lokasi" active={step === 'gps'} done={step === 'face'} accent={ACCENT} />
            <View style={[styles.stepLine, step === 'face' && styles.stepLineDone]} />
            <StepPill num={2} label="Selfie" active={step === 'face'} done={false} accent={ACCENT} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── GPS Step ── */}
          {step === 'gps' && (
            <>
              {/* Location illustration card */}
              <View style={[styles.illustrationCard, gpsValid && styles.illustrationCardValid]}>
                <View style={[styles.locationRingOuter, gpsValid && styles.locationRingOuterValid]}>
                  <View style={[styles.locationRingInner, gpsValid && styles.locationRingInnerValid]}>
                    <View style={[styles.locationDot, gpsValid && styles.locationDotValid]}>
                      {loadingGps
                        ? <ActivityIndicator color={ACCENT} size="large" />
                        : <Ionicons name={gpsValid ? 'location' : 'location-outline'} size={28} color={gpsValid ? '#fff' : '#94A3B8'} />}
                    </View>
                  </View>
                </View>
                <View style={styles.illustrationText}>
                  <Text style={[styles.illustrationTitle, gpsValid && { color: SUCCESS }]}>
                    {loadingGps ? 'Mendeteksi lokasi...' : gpsValid ? 'Lokasi Terverifikasi ✓' : 'Deteksi Lokasi GPS'}
                  </Text>
                  <Text style={styles.illustrationSub}>
                    {loadingGps
                      ? 'Sedang mengambil koordinat GPS...'
                      : gpsValid
                      ? `Akurasi ±${gps!.accuracy.toFixed(0)}m`
                      : 'Pastikan GPS aktif & izin diberikan'}
                  </Text>
                </View>
                {gpsValid && gps && (
                  <View style={styles.coordRow}>
                    <CoordChip label="LAT" value={gps.lat.toFixed(5)} />
                    <CoordChip label="LNG" value={gps.lng.toFixed(5)} />
                  </View>
                )}
              </View>

              {/* GPS button */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: gpsValid ? '#475569' : ACCENT }, loadingGps && styles.btnDisabled]}
                onPress={handleGetLocation}
                disabled={loadingGps}
                activeOpacity={0.85}
              >
                {loadingGps ? (
                  <><ActivityIndicator color="#fff" size="small" /><Text style={styles.primaryBtnText}>Mengambil lokasi...</Text></>
                ) : gpsValid ? (
                  <><Ionicons name="refresh-outline" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Perbarui Lokasi</Text></>
                ) : (
                  <><Ionicons name="navigate" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Ambil Lokasi GPS</Text></>
                )}
              </TouchableOpacity>

              {/* GPS error */}
              {gpsError ? (
                <StatusCard
                  type="error"
                  icon="location-outline"
                  title="GPS Gagal"
                  message={gpsError}
                />
              ) : null}

              {/* GPS warning */}
              {gpsWarning && !gpsError ? (
                <StatusCard
                  type="warning"
                  icon="warning-outline"
                  title="Sinyal GPS Lemah"
                  message={gpsWarning}
                  hint="Coba pindah ke area terbuka atau dekat jendela."
                />
              ) : null}

              {/* Office location status */}
              {loadingLocations ? (
                <View style={styles.officeLoadingRow}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={styles.officeLoadingText}>Memuat data lokasi kantor...</Text>
                </View>
              ) : locationFetchError ? (
                <StatusCard
                  type="error"
                  icon="business-outline"
                  title="Lokasi Kantor Tidak Ditemukan"
                  message={locationFetchError}
                  action={{ label: 'Coba Lagi', onPress: fetchOfficeLocations }}
                />
              ) : officeLocation ? (
                <View style={styles.officeSuccessRow}>
                  <View style={styles.officeSuccessIcon}>
                    <Ionicons name="business" size={14} color={SUCCESS} />
                  </View>
                  <Text style={styles.officeSuccessText}>{officeLocation.name}</Text>
                  <View style={styles.officeSuccessBadge}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                </View>
              ) : null}

              {/* Continue button */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: SUCCESS }, (!gpsValid || !!locationFetchError || loadingLocations) && styles.btnDisabled]}
                onPress={() => setStep('face')}
                disabled={!gpsValid || !!locationFetchError || loadingLocations}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Lanjut ke Foto Selfie</Text>
                <Ionicons name="arrow-forward" size={18} color={gpsValid && !locationFetchError ? '#fff' : '#94A3B8'} />
              </TouchableOpacity>

              {/* Hint why button is disabled */}
              {(!gpsValid || !!locationFetchError) && !loadingLocations && !loadingGps ? (
                <Text style={styles.disabledHint}>
                  {!gpsValid
                    ? '* Ambil lokasi GPS terlebih dahulu untuk melanjutkan'
                    : '* Lokasi kantor harus tersedia untuk melanjutkan'}
                </Text>
              ) : null}
            </>
          )}

          {/* ── Face Step ── */}
          {step === 'face' && (
            <>
              {/* Selfie area */}
              <View style={styles.selfieSection}>
                <TouchableOpacity
                  style={[styles.selfieArea, selfiePhoto && styles.selfieAreaFilled]}
                  onPress={handleOpenCamera}
                  activeOpacity={0.85}
                >
                  {selfiePhoto ? (
                    <>
                      <Image source={{ uri: selfiePhoto.uri }} style={styles.selfieImg} resizeMode="cover" />
                      <View style={styles.selfieOverlay}>
                        <View style={styles.selfieOverlayBtn}>
                          <Ionicons name="camera-reverse" size={20} color="#fff" />
                          <Text style={styles.selfieOverlayText}>Ganti</Text>
                        </View>
                      </View>
                      {/* Verified badge */}
                      <View style={styles.selfieBadge}>
                        <Ionicons name="checkmark-circle" size={28} color={SUCCESS} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.selfiePlaceholder}>
                      <View style={styles.selfieIconRing}>
                        <View style={styles.selfieIconInner}>
                          <Ionicons name="camera" size={32} color={ACCENT} />
                        </View>
                      </View>
                      <Text style={styles.selfiePlaceholderTitle}>Ambil Foto Selfie</Text>
                      <Text style={styles.selfiePlaceholderSub}>Ketuk untuk membuka kamera</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {selfiePhoto && (
                  <TouchableOpacity style={styles.retakeChip} onPress={handleOpenCamera}>
                    <Ionicons name="camera-reverse-outline" size={14} color={PRIMARY} />
                    <Text style={styles.retakeChipText}>Ambil Ulang</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tips */}
              {!selfiePhoto && (
                <View style={styles.tipsCard}>
                  <Text style={styles.tipsTitle}>Tips foto yang baik</Text>
                  <Tip text="Pastikan wajah terlihat jelas & tidak blur" />
                  <Tip text="Hindari cahaya terlalu terang dari belakang" />
                  <Tip text="Lepas kacamata jika wajah tidak terdeteksi" />
                </View>
              )}

              {cameraError ? (
                <StatusCard type="error" icon="camera-outline" title="Kamera Gagal" message={cameraError} />
              ) : null}

              {submitError ? (
                <StatusCard type="error" icon="shield-outline" title="Absensi Gagal" message={submitError} hint="Pastikan wajah jelas terlihat dan posisi GPS valid." />
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: ACCENT },
                  (!selfiePhoto || loadingSubmit || !officeLocation) && styles.btnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!selfiePhoto || loadingSubmit || !officeLocation}
                activeOpacity={0.85}
              >
                {loadingSubmit ? (
                  <><ActivityIndicator color="#fff" size="small" /><Text style={styles.primaryBtnText}>Memverifikasi wajah...</Text></>
                ) : (
                  <><Ionicons name="shield-checkmark" size={18} color={!selfiePhoto ? '#94A3B8' : '#fff'} /><Text style={styles.primaryBtnText}>Verifikasi & Absen</Text></>
                )}
              </TouchableOpacity>

              {!selfiePhoto && !loadingSubmit ? (
                <Text style={styles.disabledHint}>* Ambil foto selfie terlebih dahulu</Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepPill({ num, label, active, done, accent }: {
  num: number; label: string; active: boolean; done: boolean; accent: string;
}) {
  return (
    <View style={styles.stepPillWrap}>
      <View style={[
        styles.stepPill,
        active && styles.stepPillActive,
        done && styles.stepPillDone,
      ]}>
        {done
          ? <Ionicons name="checkmark" size={12} color={accent} />
          : <Text style={[styles.stepPillNum, active && styles.stepPillNumActive]}>{num}</Text>}
      </View>
      <Text style={[styles.stepPillLabel, (active || done) && styles.stepPillLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

function CoordChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.coordChip}>
      <Text style={styles.coordChipLabel}>{label}</Text>
      <Text style={styles.coordChipValue}>{value}</Text>
    </View>
  );
}

function AlertBox({ type, message }: { type: 'warning' | 'error'; message: string }) {
  const isErr = type === 'error';
  return (
    <View style={[styles.alertBox, isErr ? styles.alertBoxError : styles.alertBoxWarning]}>
      <Ionicons
        name={isErr ? 'alert-circle-outline' : 'warning-outline'}
        size={16}
        color={isErr ? '#DC2626' : '#B45309'}
      />
      <Text style={[styles.alertText, isErr ? styles.alertTextError : styles.alertTextWarning]}>
        {message}
      </Text>
    </View>
  );
}

function StatusCard({ type, icon, title, message, hint, action }: {
  type: 'error' | 'warning';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const isErr = type === 'error';
  const color      = isErr ? '#DC2626' : '#B45309';
  const bgColor    = isErr ? '#FEF2F2' : '#FFFBEB';
  const borderColor = isErr ? '#FECACA' : '#FDE68A';
  const iconBg     = isErr ? '#FEE2E2' : '#FEF3C7';
  return (
    <View style={[styles.statusCard, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.statusCardTop}>
        <View style={[styles.statusCardIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusCardTitle, { color }]}>{title}</Text>
          <Text style={styles.statusCardMessage}>{message}</Text>
          {hint ? <Text style={styles.statusCardHint}>{hint}</Text> : null}
        </View>
      </View>
      {action ? (
        <TouchableOpacity style={[styles.statusCardAction, { borderColor }]} onPress={action.onPress}>
          <Ionicons name="refresh" size={13} color={color} />
          <Text style={[styles.statusCardActionText, { color }]}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <View style={styles.tipDot} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

function DoneRow({ icon, label, value, valueColor }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.doneRow}>
      <View style={styles.doneRowIcon}>
        <Ionicons name={icon} size={16} color={PRIMARY} />
      </View>
      <View style={styles.doneRowBody}>
        <Text style={styles.doneRowLabel}>{label}</Text>
        <Text style={[styles.doneRowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#EFF3FB' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Hero header
  hero: {
    paddingHorizontal: 20, paddingBottom: 20,
  },
  heroNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Step row in hero
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepPillWrap: { alignItems: 'center', gap: 4 },
  stepPill: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepPillActive: { backgroundColor: '#fff' },
  stepPillDone:   { backgroundColor: 'rgba(255,255,255,0.9)' },
  stepPillNum:    { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  stepPillNumActive: { color: PRIMARY },
  stepPillLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  stepPillLabelActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 6, marginBottom: 16 },
  stepLineDone: { backgroundColor: 'rgba(255,255,255,0.7)' },

  // Illustration card (GPS)
  illustrationCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  locationRingOuter: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  locationRingInner: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center',
  },
  locationDot: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  locationDotValid: { backgroundColor: SUCCESS },
  illustrationText: { alignItems: 'center', gap: 4 },
  illustrationTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  illustrationSub: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  // Primary button
  primaryBtn: {
    borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  btnDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabledHint: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: -6 },

  // GPS coord chips
  coordRow: { flexDirection: 'row', gap: 10, width: '100%' },
  coordChip: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  coordChipLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  coordChipValue: { fontSize: 13, fontWeight: '700', color: '#1E293B', fontFamily: 'monospace', marginTop: 2 },

  // Illustration card valid state
  illustrationCardValid: { borderWidth: 2, borderColor: '#BBF7D0' },
  locationRingOuterValid: { backgroundColor: '#DCFCE7' },
  locationRingInnerValid: { backgroundColor: '#BBF7D0' },

  // Office location status
  officeLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  officeLoadingText: { fontSize: 13, color: '#64748B' },
  officeSuccessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  officeSuccessIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  officeSuccessText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#15803D' },
  officeSuccessBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: SUCCESS, alignItems: 'center', justifyContent: 'center',
  },

  // StatusCard
  statusCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10,
  },
  statusCardTop: { flexDirection: 'row', gap: 12 },
  statusCardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  statusCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  statusCardMessage: { fontSize: 13, color: '#475569', lineHeight: 18 },
  statusCardHint: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
  statusCardAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderTopWidth: 1, paddingTop: 10, marginTop: 2,
  },
  statusCardActionText: { fontSize: 13, fontWeight: '700' },

  // Alert boxes
  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  alertBoxError:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertBoxWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  alertText: { flex: 1, fontSize: 13, fontWeight: '500' },
  alertTextError:   { color: '#DC2626' },
  alertTextWarning: { color: '#B45309' },

  // Selfie
  selfieSection: { alignItems: 'center', gap: 12 },
  selfieArea: {
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#EFF6FF',
    borderWidth: 3, borderColor: '#BFDBFE', borderStyle: 'dashed',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  selfieAreaFilled: { borderStyle: 'solid', borderColor: SUCCESS, borderWidth: 4 },
  selfieImg: { width: '100%', height: '100%' },
  selfieOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  selfieOverlayBtn: { alignItems: 'center', gap: 2 },
  selfieOverlayText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  selfieBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 2,
  },
  selfiePlaceholder: { alignItems: 'center', gap: 10 },
  selfieIconRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center',
  },
  selfieIconInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  selfiePlaceholderTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  selfiePlaceholderSub: { fontSize: 12, color: '#94A3B8' },
  retakeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  retakeChipText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },

  // Tips card
  tipsCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY },
  tipText: { fontSize: 12, color: '#64748B', flex: 1 },

  // Camera UI
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
  instructionBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  instructionText: {
    color: '#fff', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, overflow: 'hidden',
  },
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

  // Done screen
  doneRoot: { flex: 1, backgroundColor: '#EFF3FB' },
  doneHero: {
    paddingBottom: 36,
    alignItems: 'center', gap: 12,
  },
  doneIconWrap: { marginBottom: 4 },
  doneRingOuter: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  doneRingInner: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  doneCheckCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  doneHeroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  doneHeroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneHeroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  doneBody: { flex: 1, padding: 20, gap: 14 },
  doneTimeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  doneTimeValue: { fontSize: 26, fontWeight: '800', flex: 1 },
  doneTimeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  doneTimeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  doneInfoCard: {
    backgroundColor: '#fff', borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  doneInfoDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  doneRowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  doneRowBody: { flex: 1 },
  doneRowLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  doneRowValue: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 2 },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, height: 54, marginTop: 4,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
