import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function AttendanceScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter mode: 'month' or 'range'
  const [filterMode, setFilterMode] = useState('month');

  // Month filter
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  // Date range filter
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(now);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadData = async () => {
    try {
      let params;
      if (filterMode === 'month') {
        params = { month: selMonth + 1, year: selYear };
      } else {
        params = { start_date: formatDate(startDate), end_date: formatDate(endDate) };
      }
      const data = await api.getHistory(params);
      setHistory(data.attendance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [filterMode, selMonth, selYear, startDate, endDate])
  );

  const changeMonth = (delta) => {
    let m = selMonth + delta;
    let y = selYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelMonth(m);
    setSelYear(y);
  };

  const statusConfig = (status) => {
    const map = {
      present: { bg: colors.successLight, text: colors.success, icon: 'checkmark-circle' },
      late: { bg: colors.warningLight, text: colors.warning, icon: 'alert-circle' },
      absent: { bg: colors.dangerLight, text: colors.danger, icon: 'close-circle' },
      'half-day': { bg: '#fff7ed', text: '#ea580c', icon: 'time' },
    };
    return map[status] || { bg: '#f1f5f9', text: colors.textSecondary, icon: 'ellipse' };
  };

  const renderItem = ({ item }) => {
    const s = statusConfig(item.status);
    const dateObj = new Date(item.date + 'T00:00:00');
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    return (
      <View style={[styles.row, isWeekend && styles.rowWeekend]}>
        <View style={[styles.dateCol, { borderLeftColor: s.text }]}>
          <Text style={styles.dateDay}>
            {dateObj.toLocaleDateString('en-US', { day: 'numeric' })}
          </Text>
          <Text style={styles.dateWeekday}>
            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <View style={styles.timeInfo}>
            <View style={styles.timeChip}>
              <Ionicons name="enter-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.timeText}>
                {item.check_in ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            <View style={styles.timeChip}>
              <Ionicons name="exit-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.timeText}>
                {item.check_out ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
          </View>
          {item.work_hours > 0 && (
            <Text style={styles.hoursText}>{item.work_hours}h worked</Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={12} color={s.text} />
          <Text style={[styles.badgeText, { color: s.text }]}>{item.status}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const presentCount = history.filter(h => h.status === 'present').length;
  const lateCount = history.filter(h => h.status === 'late').length;

  return (
    <View style={styles.container}>
      {/* Filter mode toggle */}
      <View style={styles.filterToggle}>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'month' && styles.filterTabActive]}
          onPress={() => setFilterMode('month')}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={14} color={filterMode === 'month' ? colors.white : colors.textSecondary} />
          <Text style={[styles.filterTabText, filterMode === 'month' && styles.filterTabTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'range' && styles.filterTabActive]}
          onPress={() => setFilterMode('range')}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal-outline" size={14} color={filterMode === 'range' ? colors.white : colors.textSecondary} />
          <Text style={[styles.filterTabText, filterMode === 'range' && styles.filterTabTextActive]}>Date Range</Text>
        </TouchableOpacity>
      </View>

      {/* Month selector */}
      {filterMode === 'month' && (
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMonthPickerVisible(true)} activeOpacity={0.7}>
            <Text style={styles.monthLabel}>{MONTHS[selMonth]} {selYear}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} activeOpacity={0.6}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Date range selector */}
      {filterMode === 'range' && (
        <View style={styles.dateRangeRow}>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartPicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.datePickerText}>{startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </TouchableOpacity>
          <Text style={styles.dateRangeSep}>to</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEndPicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.datePickerText}>{endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={endDate}
          onChange={(e, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={startDate}
          maximumDate={new Date()}
          onChange={(e, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Month picker modal */}
      <Modal visible={monthPickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMonthPickerVisible(false)} activeOpacity={1}>
          <View style={styles.monthPickerCard}>
            <View style={styles.monthPickerHeader}>
              <TouchableOpacity onPress={() => setSelYear(y => y - 1)}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthPickerYear}>{selYear}</Text>
              <TouchableOpacity onPress={() => setSelYear(y => y + 1)}>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthGridItem, selMonth === i && styles.monthGridItemActive]}
                  onPress={() => { setSelMonth(i); setMonthPickerVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.monthGridText, selMonth === i && styles.monthGridTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{history.length}</Text>
          <Text style={styles.summaryLabel}>Records</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{presentCount}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{lateCount}</Text>
          <Text style={styles.summaryLabel}>Late</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No Records</Text>
            <Text style={styles.emptyDesc}>No attendance records for this period</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // Filter toggle
  filterToggle: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    marginTop: spacing.lg, backgroundColor: colors.white,
    borderRadius: radius.md, padding: 3, ...shadows.sm,
  },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: radius.sm,
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: colors.white },

  // Month selector
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing.xl, marginTop: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingVertical: spacing.sm, ...shadows.sm,
  },
  monthArrow: { padding: spacing.sm },
  monthLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginHorizontal: spacing.lg },

  // Date range
  dateRangeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.xl, marginTop: spacing.md, gap: spacing.sm,
  },
  datePickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.white, borderRadius: radius.md,
    paddingVertical: 10, ...shadows.sm,
  },
  datePickerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dateRangeSep: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },

  // Month picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },
  monthPickerCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.xl, width: '100%', maxWidth: 320,
  },
  monthPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  monthPickerYear: { fontSize: 18, fontWeight: '800', color: colors.text },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  monthGridItem: {
    width: '30%', alignItems: 'center',
    paddingVertical: 12, borderRadius: radius.sm,
  },
  monthGridItemActive: { backgroundColor: colors.primary },
  monthGridText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  monthGridTextActive: { color: colors.white },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: spacing.xl,
    marginTop: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.md, paddingVertical: spacing.md,
    ...shadows.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 1, fontWeight: '500' },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },

  // List
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  row: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    ...shadows.sm,
  },
  rowWeekend: { opacity: 0.7 },
  dateCol: {
    alignItems: 'center', marginRight: spacing.lg, minWidth: 42,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
  },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.text },
  dateWeekday: { fontSize: 11, color: colors.textTertiary, marginTop: 1, fontWeight: '500' },
  infoCol: { flex: 1 },
  timeInfo: { flexDirection: 'row', gap: spacing.sm },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.background, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: radius.sm,
  },
  timeText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  hoursText: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontWeight: '500' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textTertiary, marginTop: spacing.md },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },
});
