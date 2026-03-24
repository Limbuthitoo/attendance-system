import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      const [todayData, statsData] = await Promise.all([
        api.getToday(),
        api.getStats(),
      ]);
      setToday(todayData.attendance);
      setStats(statsData);
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

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const data = await api.checkIn();
      setToday(data.attendance);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const data = await api.checkOut();
      setToday(data.attendance);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const monthStats = {};
  (stats?.monthAttendance || []).forEach(s => { monthStats[s.status] = s.count; });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()},</Text>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.meta}>{user?.department} · {user?.designation}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)}</Text>
        </View>
      </View>

      {/* Today's Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Attendance</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {today ? (
          <View style={styles.todayInfo}>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check In</Text>
                <Text style={styles.timeValue}>
                  {today.check_in ? new Date(today.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
              </View>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check Out</Text>
                <Text style={styles.timeValue}>
                  {today.check_out ? new Date(today.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </Text>
              </View>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Hours</Text>
                <Text style={styles.timeValue}>{today.work_hours ? `${today.work_hours}h` : '—'}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, getStatusStyle(today.status)]}>
              <Text style={[styles.statusText, getStatusTextStyle(today.status)]}>{today.status}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.notCheckedIn}>Not checked in yet</Text>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {(!today || !today.check_in) && (
            <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn} disabled={actionLoading} activeOpacity={0.8}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Check In</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {today?.check_in && !today?.check_out && (
            <TouchableOpacity style={styles.checkOutBtn} onPress={handleCheckOut} disabled={actionLoading} activeOpacity={0.8}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Check Out</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {today?.check_out && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.completedText}>Day Complete</Text>
            </View>
          )}
        </View>
      </View>

      {/* Monthly Stats */}
      <Text style={styles.sectionTitle}>This Month</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="checkmark-circle" label="Present" value={monthStats.present || 0} color={colors.success} bgColor={colors.successLight} />
        <StatCard icon="alert-circle" label="Late" value={monthStats.late || 0} color={colors.warning} bgColor={colors.warningLight} />
        <StatCard icon="close-circle" label="Absent" value={monthStats.absent || 0} color={colors.danger} bgColor={colors.dangerLight} />
        <StatCard icon="time" label="Hours" value={`${stats?.totalWorkHours || 0}h`} color={colors.primary} bgColor={colors.primaryLight} />
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function getStatusStyle(status) {
  const map = {
    present: { backgroundColor: colors.successLight },
    late: { backgroundColor: colors.warningLight },
    absent: { backgroundColor: colors.dangerLight },
    'half-day': { backgroundColor: '#fff7ed' },
  };
  return map[status] || { backgroundColor: '#f1f5f9' };
}

function getStatusTextStyle(status) {
  const map = {
    present: { color: colors.success },
    late: { color: colors.warning },
    absent: { color: colors.danger },
    'half-day': { color: '#ea580c' },
  };
  return map[status] || { color: colors.textSecondary };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  greeting: { fontSize: 14, color: colors.textSecondary },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.xl, marginBottom: spacing.xxl, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  dateText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  todayInfo: {},
  timeRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md },
  timeBlock: {},
  timeLabel: { fontSize: 11, color: colors.textTertiary, marginBottom: 2 },
  timeValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: spacing.sm },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  notCheckedIn: { fontSize: 13, color: colors.textTertiary, marginBottom: spacing.md },
  actions: { marginTop: spacing.lg },
  checkInBtn: { backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  checkOutBtn: { backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  completedText: { fontSize: 15, fontWeight: '600', color: colors.success },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: { backgroundColor: colors.white, borderRadius: 14, padding: spacing.lg, width: '47%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
