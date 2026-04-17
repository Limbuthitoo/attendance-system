import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Platform, StatusBar
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG = {
  present:  { label: 'Present',  color: colors.success,  bg: colors.successLight, icon: 'checkmark-circle' },
  late:     { label: 'Late',     color: colors.warning,  bg: colors.warningLight, icon: 'alert-circle' },
  'half-day': { label: 'Half Day', color: '#ea580c',     bg: '#fff7ed',          icon: 'time' },
  absent:   { label: 'Absent',   color: colors.danger,   bg: colors.dangerLight,  icon: 'close-circle' },
};

export default function EmployeeAttendanceScreen() {
  const [data, setData] = useState({ attendance: [], summary: {}, departments: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');

  const defaultSummary = { total: 0, present: 0, late: 0, halfDay: 0, absent: 0 };

  const loadData = async () => {
    try {
      const res = await api.getAllAttendance(dateStr);
      setData({
        attendance: res.attendance || [],
        summary: res.summary || defaultSummary,
        departments: res.departments || [],
      });
    } catch {
      setData({ attendance: [], summary: defaultSummary, departments: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [dateStr])
  );

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
  };

  const filtered = data.attendance.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const { summary } = data;

  const renderItem = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.absent;
    return (
      <View style={styles.row}>
        <View style={styles.empInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
          </View>
          <View style={styles.empDetails}>
            <Text style={styles.empName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.empMeta}>{item.emp_code} · {item.department}</Text>
          </View>
        </View>
        <View style={styles.timesRow}>
          {item.check_in ? (
            <View style={styles.timeChipIn}>
              <Ionicons name="enter-outline" size={12} color={colors.success} />
              <Text style={styles.timeTextIn}>{formatTime(item.check_in)}</Text>
            </View>
          ) : (
            <Text style={styles.timeDash}>—</Text>
          )}
          {item.check_out ? (
            <View style={styles.timeChipOut}>
              <Ionicons name="exit-outline" size={12} color="#3b82f6" />
              <Text style={styles.timeTextOut}>{formatTime(item.check_out)}</Text>
            </View>
          ) : (
            <Text style={styles.timeDash}>—</Text>
          )}
          {item.work_hours ? (
            <Text style={styles.hoursText}>{item.work_hours}h</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date selector */}
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateLabel}>
            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateArrow} activeOpacity={0.6}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(new Date())} style={styles.todayBtn} activeOpacity={0.7}>
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { key: 'all', label: 'Total', value: summary.total, color: colors.text },
          { key: 'present', label: 'Present', value: summary.present, color: colors.success },
          { key: 'late', label: 'Late', value: summary.late, color: colors.warning },
          { key: 'absent', label: 'Absent', value: summary.absent, color: colors.danger },
        ].map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <View style={styles.summaryDivider} />}
            <TouchableOpacity
              style={[styles.summaryItem, statusFilter === s.key && styles.summaryItemActive]}
              onPress={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key === 'all' ? 'all' : s.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.summaryValue, { color: s.color }]}>{s.value || 0}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.employee_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No Employees</Text>
            <Text style={styles.emptyDesc}>No attendance data for this date</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  dateBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: spacing.lg,
    marginTop: spacing.lg, borderRadius: radius.md,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.xs,
    ...shadows.sm,
  },
  dateArrow: { padding: spacing.sm },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  todayBtn: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.sm,
  },
  todayText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, marginHorizontal: spacing.lg,
    marginTop: spacing.sm, borderRadius: radius.md,
    paddingVertical: spacing.md, ...shadows.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  summaryItemActive: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, marginHorizontal: 2 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 1 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  row: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm,
  },
  empInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  empDetails: { flex: 1 },
  empName: { fontSize: 14, fontWeight: '700', color: colors.text },
  empMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

  timesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  timeChipIn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.success + '30',
  },
  timeTextIn: { fontSize: 12, fontWeight: '700', color: colors.success },
  timeChipOut: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 1, borderColor: '#93c5fd50',
  },
  timeTextOut: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  timeDash: { fontSize: 13, color: colors.border, fontWeight: '500' },
  hoursText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginLeft: 'auto' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textTertiary, marginTop: spacing.md },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },
});
