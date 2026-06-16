import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#1565C0';
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Mon-first-of-month-aligned grid for one month, padded with `null` to fill whole weeks. */
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Currently selected date, if any. */
  value?: Date;
  /** Days before this are greyed out and not selectable. */
  minimumDate?: Date;
  onSelect: (date: Date) => void;
  title?: string;
};

/**
 * Fully custom month-grid date picker, styled to match the app instead of
 * relying on the OS native picker (which has inconsistent light/dark
 * contrast across devices).
 */
export default function CalendarPicker({ visible, onClose, value, minimumDate, onSelect, title }: Props) {
  const initial = value ?? minimumDate ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Re-sync the visible month whenever the picker is opened.
  useEffect(() => {
    if (!visible) return;
    const d = value ?? minimumDate ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [visible]);

  const today = startOfDay(new Date());
  const min = minimumDate ? startOfDay(minimumDate) : undefined;
  const cells = buildMonthGrid(viewYear, viewMonth);
  const prevDisabled = !!min && viewYear === min.getFullYear() && viewMonth === min.getMonth();

  function goPrevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function goNextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Month nav */}
          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={goPrevMonth}
              disabled={prevDisabled}
              style={[styles.navBtn, prevDisabled && styles.navBtnDisabled]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={prevDisabled ? '#CBD5E1' : PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goNextMonth} style={styles.navBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={styles.weekDayText}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((cell, i) => {
              if (!cell) return <View key={i} style={styles.cell} />;
              const disabled = !!min && cell < min;
              const selected = !!value && isSameDay(cell, value);
              const isToday = isSameDay(cell, today);
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.cell}
                  disabled={disabled}
                  onPress={() => onSelect(cell)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.dayDot,
                    selected && styles.dayDotSelected,
                    !selected && isToday && styles.dayDotToday,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      disabled && styles.dayTextDisabled,
                      selected && styles.dayTextSelected,
                      !selected && isToday && styles.dayTextToday,
                    ]}>
                      {cell.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>Tutup</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const CELL = '14.2857%';

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: '#fff', borderRadius: 20,
    padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 10,
  },
  title: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.6,
    textAlign: 'center', marginBottom: 10,
  },

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { backgroundColor: '#F8FAFC' },
  monthLabel: { fontSize: 15, fontWeight: '800', color: '#1E293B' },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDayText: {
    width: CELL, textAlign: 'center',
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: {
    width: '78%', height: '78%', borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDotSelected: { backgroundColor: PRIMARY },
  dayDotToday: { borderWidth: 1.5, borderColor: PRIMARY },
  dayText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  dayTextDisabled: { color: '#CBD5E1' },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
  dayTextToday: { color: PRIMARY, fontWeight: '800' },

  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  closeBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
});
