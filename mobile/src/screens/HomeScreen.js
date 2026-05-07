import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Platform, Animated, StatusBar, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [myAssignment, setMyAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isAdmin = user?.role === 'admin';

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Pulse animation for check-in button
  useEffect(() => {
    if (!today || !today.check_in) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [today, pulseAnim]);

  const loadData = async () => {
    try {
      const promises = [api.getToday(), api.getStats()];
      promises.push(api.getNotices(3).catch(() => ({ notices: [] })));
      promises.push(api.getMyAssignment().catch(() => ({ assignment: null })));
      const [todayData, statsData, noticesData, assignData] = await Promise.all(promises);
      setToday(todayData.attendance);
      setStats(statsData);
      setNotices(noticesData.notices || []);
      setMyAssignment(assignData.assignment || null);
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
      let latitude, longitude;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch { /* location optional */ }
      const data = await api.checkIn(latitude, longitude);
      setToday(data.attendance);
      loadData();
    } catch (err) {
      Alert.alert('Check-in Failed', err.message);
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
  (stats?.monthAttendance || stats?.monthlyStats || []).forEach(s => { monthStats[s.status] = s.count; });

  const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      {/* ── Dark Header ──────────────────────────── */}
      <View style={styles.headerBg}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good {getGreeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
          </View>
          <TouchableOpacity style={styles.headerRight} onPress={() => navigation.navigate('ProfileModal')} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Date & Time strip */}
        <View style={styles.dateTimeStrip}>
          <View style={styles.dateTimeItem}>
            <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
            <Text style={styles.dateTimeText}>{formatDate(currentTime)}</Text>
          </View>
          <View style={styles.dateTimeDot} />
          <View style={styles.dateTimeItem}>
            <Ionicons name="time-outline" size={14} color="#94a3b8" />
            <Text style={styles.dateTimeText}>{formatTime(currentTime)}</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable Content ────────────────────── */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />
        }
      >
        {/* ── Attendance Card (Dark) ────────────────── */}
        <View style={styles.attendanceCard}>
          {/* Card header */}
          <View style={styles.attCardTop}>
            <View style={styles.attCardTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              <Text style={styles.attCardTitle}>Today's Attendance</Text>
            </View>
            {today?.status ? (
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(today.status) + '25' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(today.status) }]} />
                <Text style={[styles.statusLabel, { color: getStatusColor(today.status) }]}>
                  {today.status}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusPill, { backgroundColor: colors.background }]}>
                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>Awaiting</Text>
              </View>
            )}
          </View>

          {/* Timeline row */}
          {today ? (
            <View style={styles.timelineRow}>
              {/* Check In */}
              <View style={styles.timelineNode}>
                <View style={[styles.timelineDot, today.check_in ? styles.timelineDotActive : styles.timelineDotInactive]}>
                  <Ionicons name="arrow-down" size={14} color={today.check_in ? '#fff' : colors.textTertiary} />
                </View>
                <Text style={styles.timelineLabel}>IN</Text>
                <Text style={styles.timelineTime}>
                  {today.check_in ? new Date(today.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </Text>
              </View>

              {/* Connecting line */}
              <View style={styles.timelineLine}>
                <View style={[
                  styles.timelineLineFill,
                  { width: today.check_out ? '100%' : today.check_in ? '50%' : '0%' }
                ]} />
              </View>

              {/* Duration */}
              <View style={styles.timelineDuration}>
                <View style={styles.durationCircle}>
                  <Text style={styles.durationValue}>{today.work_hours ? today.work_hours : '0'}</Text>
                  <Text style={styles.durationUnit}>hrs</Text>
                </View>
              </View>

              {/* Connecting line */}
              <View style={styles.timelineLine}>
                <View style={[
                  styles.timelineLineFill,
                  { width: today.check_out ? '100%' : '0%' }
                ]} />
              </View>

              {/* Check Out */}
              <View style={styles.timelineNode}>
                <View style={[styles.timelineDot, today.check_out ? styles.timelineDotDanger : styles.timelineDotInactive]}>
                  <Ionicons name="arrow-up" size={14} color={today.check_out ? '#fff' : colors.textTertiary} />
                </View>
                <Text style={styles.timelineLabel}>OUT</Text>
                <Text style={styles.timelineTime}>
                  {today.check_out ? new Date(today.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </Text>
              </View>
            </View>
          ) : (
            /* Not checked in state */
            <View style={styles.notCheckedInBox}>
              <View style={styles.notCheckedInCircle}>
                <Ionicons name="finger-print-outline" size={36} color={colors.textTertiary} />
              </View>
              <Text style={styles.notCheckedInText}>Ready to start your day?</Text>
              <Text style={styles.notCheckedInSub}>Tap the button below to check in</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.attActionArea}>
            {(!today || !today.check_in) && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn} disabled={actionLoading} activeOpacity={0.7}>
                  {actionLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <View style={styles.btnIconCircle}>
                        <Ionicons name="finger-print" size={20} color={colors.success} />
                      </View>
                      <Text style={styles.actionBtnText}>Check In Now</Text>
                      <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
            {today?.check_in && !today?.check_out && (
              <TouchableOpacity style={styles.checkOutBtn} onPress={handleCheckOut} disabled={actionLoading} activeOpacity={0.7}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <View style={[styles.btnIconCircle, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <Ionicons name="log-out-outline" size={20} color={colors.dangerMuted} />
                    </View>
                    <Text style={styles.actionBtnText}>Check Out</Text>
                    <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
                  </>
                )}
              </TouchableOpacity>
            )}
            {today?.check_out && (
              <View style={styles.completedBanner}>
                <View style={styles.completedCheckCircle}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedTitle}>Day Complete</Text>
                  <Text style={styles.completedSub}>{today.work_hours}h logged — Great work!</Text>
                </View>
                <Ionicons name="sparkles" size={20} color={colors.warningMuted} />
              </View>
            )}
          </View>
        </View>

        {/* ── Monthly Overview ────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Monthly Overview</Text>
          <TouchableOpacity onPress={() => navigation.navigate('My Attendance')} activeOpacity={0.7}>
            <Text style={styles.seeAllLink}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <MiniStat
            icon="checkmark-circle"
            value={monthStats.present || 0}
            label="Present"
            color={colors.success}
            bg={colors.successLight}
          />
          <MiniStat
            icon="alert-circle"
            value={monthStats.late || 0}
            label="Late"
            color={colors.warningMuted}
            bg={colors.warningLight}
          />
          <MiniStat
            icon="close-circle"
            value={monthStats.absent || 0}
            label="Absent"
            color={colors.danger}
            bg={colors.dangerLight}
          />
          <MiniStat
            icon="time"
            value={`${stats?.totalWorkHours || 0}h`}
            label="Hours"
            color={colors.primary}
            bg={colors.primaryLight}
          />
        </View>

        {/* ── My Shift & Schedule Info ────────────── */}
        {myAssignment && (
          <View style={styles.shiftCard}>
            <View style={styles.shiftCardHeader}>
              <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
              <Text style={styles.shiftCardTitle}>My Assignment</Text>
            </View>
            <View style={styles.shiftCardGrid}>
              {myAssignment.branch && (
                <View style={styles.shiftCardItem}>
                  <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.shiftCardLabel}>{myAssignment.branch.name}</Text>
                </View>
              )}
              {myAssignment.shift && (
                <View style={styles.shiftCardItem}>
                  <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.shiftCardLabel}>
                    {myAssignment.shift.name} ({myAssignment.shift.startTime}–{myAssignment.shift.endTime})
                  </Text>
                </View>
              )}
              {myAssignment.workSchedule && (
                <View style={styles.shiftCardItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.shiftCardLabel}>
                    {myAssignment.workSchedule.name} ({(myAssignment.workSchedule.workingDays || []).length}d/week)
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Admin Overview (admin only) ─────────── */}
        {isAdmin && stats && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Team Today</Text>
            </View>
            <View style={styles.adminGrid}>
              <View style={styles.adminCard}>
                <View style={styles.adminRow}>
                  <View style={[styles.adminDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.adminLabel}>Total Staff</Text>
                </View>
                <Text style={styles.adminValue}>{stats.totalEmployees || 0}</Text>
              </View>
              <View style={styles.adminCard}>
                <View style={styles.adminRow}>
                  <View style={[styles.adminDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.adminLabel}>Present</Text>
                </View>
                <Text style={[styles.adminValue, { color: colors.success }]}>{stats.presentToday || 0}</Text>
              </View>
              <View style={styles.adminCard}>
                <View style={styles.adminRow}>
                  <View style={[styles.adminDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.adminLabel}>Late</Text>
                </View>
                <Text style={[styles.adminValue, { color: colors.warning }]}>{stats.lateToday || 0}</Text>
              </View>
              <View style={styles.adminCard}>
                <View style={styles.adminRow}>
                  <View style={[styles.adminDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.adminLabel}>Absent</Text>
                </View>
                <Text style={[styles.adminValue, { color: colors.danger }]}>{stats.absentToday || 0}</Text>
              </View>
            </View>
          </>
        )}

        {/* ── Latest Notices ─────────────────────── */}
        {notices.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Latest Notices</Text>
              <TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'NoticesPage' })} activeOpacity={0.7}>
                <Text style={styles.seeAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {notices.slice(0, 2).map((notice) => (
              <TouchableOpacity
                key={notice.id}
                style={styles.noticeCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('More', { screen: 'NoticesPage' })}
              >
                <View style={[styles.noticeIcon, notice.type === 'urgent' && { backgroundColor: colors.dangerLight }]}>
                  <Ionicons
                    name={notice.type === 'urgent' ? 'alert-circle-outline' : 'megaphone-outline'}
                    size={18}
                    color={notice.type === 'urgent' ? colors.danger : colors.primary}
                  />
                </View>
                <View style={styles.noticeContent}>
                  <Text style={styles.noticeTitle} numberOfLines={1}>{notice.title}</Text>
                  <Text style={styles.noticeBody} numberOfLines={1}>{notice.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Leave balance (employee) */}
        {!isAdmin && (stats?.pendingLeaves > 0 || stats?.approvedLeaves > 0) && (
          <View style={styles.leaveInfoCard}>
            <View style={styles.leaveInfoRow}>
              <View style={styles.leaveInfoItem}>
                <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                <Text style={styles.leaveInfoLabel}>Pending Leaves</Text>
                <Text style={styles.leaveInfoValue}>{stats.pendingLeaves || 0}</Text>
              </View>
              <View style={styles.leaveInfoDivider} />
              <View style={styles.leaveInfoItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                <Text style={styles.leaveInfoLabel}>Approved</Text>
                <Text style={styles.leaveInfoValue}>{stats.approvedLeaves || 0}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ────────────────────────────── */

function MiniStat({ icon, value, label, color, bg }) {
  return (
    <View style={styles.miniStat}>
      <View style={[styles.miniStatIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

/* ── Helpers ──────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function getStatusColor(status) {
  const map = {
    present: colors.success,
    late: colors.warning,
    absent: colors.danger,
    'half-day': '#ea580c',
    'on-leave': '#7c3aed',
    holiday: '#2563eb',
    'weekly-off': '#4f46e5',
    'missing-checkout': '#e11d48',
    'early-exit': '#ec4899',
  };
  return map[status] || colors.textSecondary;
}

/* ── Styles ───────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // ─ Header ─
  headerBg: {
    backgroundColor: colors.headerDark,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  headerRight: {},
  greeting: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  name: {
    fontSize: 26, fontWeight: '800', color: colors.textInverse,
    marginTop: 2, letterSpacing: -0.5,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: { fontSize: 19, fontWeight: '800', color: colors.textInverse },
  dateTimeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.md,
  },
  dateTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  dateTimeDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#475569' },

  // ─ Content ─
  scrollArea: { flex: 1, marginTop: -20 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },

  // ─ Attendance Card ─
  attendanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden', marginBottom: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.md,
  },
  attCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl, paddingBottom: spacing.md,
  },
  attCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Timeline
  timelineRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
  },
  timelineNode: { alignItems: 'center', width: 56 },
  timelineDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  timelineDotActive: { backgroundColor: colors.success },
  timelineDotDanger: { backgroundColor: colors.dangerMuted },
  timelineDotInactive: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border },
  timelineLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1 },
  timelineTime: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  timelineLine: {
    flex: 1, height: 3, backgroundColor: colors.border,
    borderRadius: 2, overflow: 'hidden', marginBottom: 24,
  },
  timelineLineFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  timelineDuration: { alignItems: 'center', marginBottom: 24, marginHorizontal: 4 },
  durationCircle: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 3, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  durationValue: { fontSize: 20, fontWeight: '900', color: colors.primary, lineHeight: 22 },
  durationUnit: { fontSize: 9, fontWeight: '700', color: colors.primaryMuted, marginTop: -1 },

  // Not checked in
  notCheckedInBox: {
    alignItems: 'center', paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  notCheckedInCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  notCheckedInText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  notCheckedInSub: { fontSize: 13, color: colors.textTertiary, marginTop: 4 },

  // Actions
  attActionArea: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  checkInBtn: {
    backgroundColor: colors.success,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    ...shadows.sm,
  },
  checkOutBtn: {
    backgroundColor: colors.dangerMuted,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    ...shadows.sm,
  },
  btnIconCircle: {
    position: 'absolute', left: spacing.lg,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(5,150,105,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', marginRight: 6 },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.successLight, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.success + '30',
  },
  completedCheckCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  completedTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  completedSub: { fontSize: 12, color: colors.successMuted, marginTop: 1 },

  // ─ Section headers ─
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  seeAllLink: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // ─ Mini Stats ─
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  miniStat: {
    flex: 1, backgroundColor: colors.white,
    borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', ...shadows.sm,
  },
  miniStatIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  miniStatValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  miniStatLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 1 },

  // ─ Admin Grid ─
  adminGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  adminCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, width: '48.5%', ...shadows.sm,
  },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  adminDot: { width: 8, height: 8, borderRadius: 4 },
  adminLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  adminValue: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

  // ─ Notice cards ─
  noticeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.sm, ...shadows.sm,
  },
  noticeIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  noticeBody: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },

  // ─ Leave info ─
  leaveInfoCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginTop: spacing.md, ...shadows.sm,
  },
  leaveInfoRow: { flexDirection: 'row', alignItems: 'center' },
  leaveInfoItem: { flex: 1, alignItems: 'center', gap: 4 },
  leaveInfoLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
  leaveInfoValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  leaveInfoDivider: { width: 1, height: 36, backgroundColor: colors.border },

  // ─ Shift card ─
  shiftCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.lg, marginTop: spacing.md, ...shadows.sm,
  },
  shiftCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  shiftCardTitle: {
    fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.3,
  },
  shiftCardGrid: { gap: 8 },
  shiftCardItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  shiftCardLabel: {
    fontSize: 13, color: colors.textSecondary, fontWeight: '500',
  },
});
