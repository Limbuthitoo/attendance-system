import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing } from '../theme';

export default function AttendanceScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const loadData = async () => {
    try {
      const data = await api.getHistory(month, year);
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
    }, [])
  );

  const statusStyle = (status) => {
    const map = {
      present: { bg: colors.successLight, text: colors.success },
      late: { bg: colors.warningLight, text: colors.warning },
      absent: { bg: colors.dangerLight, text: colors.danger },
      'half-day': { bg: '#fff7ed', text: '#ea580c' },
    };
    return map[status] || { bg: '#f1f5f9', text: colors.textSecondary };
  };

  const renderItem = ({ item }) => {
    const s = statusStyle(item.status);
    return (
      <View style={styles.row}>
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>
            {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric' })}
          </Text>
          <Text style={styles.dateWeekday}>
            {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              In: {item.check_in ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
            <Text style={styles.timeText}>
              Out: {item.check_out ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
          {item.work_hours > 0 && (
            <Text style={styles.hoursText}>{item.work_hours}h worked</Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
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

  return (
    <View style={styles.container}>
      <Text style={styles.monthTitle}>
        {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
      </Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No attendance records this month</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 15, fontWeight: '600', color: colors.text, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  row: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  dateCol: { alignItems: 'center', marginRight: spacing.lg, minWidth: 40 },
  dateDay: { fontSize: 20, fontWeight: '700', color: colors.text },
  dateWeekday: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  infoCol: { flex: 1 },
  timeInfo: { flexDirection: 'row', gap: spacing.md },
  timeText: { fontSize: 13, color: colors.textSecondary },
  hoursText: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: colors.textTertiary, fontSize: 14, marginTop: spacing.xxxl },
});
