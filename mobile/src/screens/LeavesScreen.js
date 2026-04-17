import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, ScrollView, RefreshControl, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const STATUS_CONFIG = {
  pending: { bg: colors.warningLight, text: colors.warning, icon: 'hourglass-outline' },
  approved: { bg: colors.successLight, text: colors.success, icon: 'checkmark-circle-outline' },
  rejected: { bg: colors.dangerLight, text: colors.danger, icon: 'close-circle-outline' },
};

const LEAVE_TYPE_ICONS = {
  casual: 'sunny-outline',
  sick: 'medkit-outline',
  earned: 'star-outline',
  unpaid: 'wallet-outline',
  other: 'ellipsis-horizontal-outline',
};

export default function LeavesScreen() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadLeaves = async () => {
    try {
      const data = await api.getMyLeaves('');
      setLeaves(data.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLeaves();
    }, [])
  );

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date || !form.reason) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.applyLeave(form);
      setShowForm(false);
      setForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id) => {
    Alert.alert('Cancel Leave', 'Are you sure you want to cancel this leave request?', [
      { text: 'No' },
      {
        text: 'Yes', style: 'destructive', onPress: async () => {
          try {
            await api.cancelLeave(id);
            loadLeaves();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        }
      },
    ]);
  };

  const leaveTypes = ['casual', 'sick', 'earned', 'unpaid', 'other'];

  const renderItem = ({ item }) => {
    const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <View style={styles.leaveCard}>
        <View style={[styles.cardAccent, { backgroundColor: s.text }]} />
        <View style={styles.cardBody}>
          <View style={styles.leaveHeader}>
            <View style={styles.leaveInfo}>
              <View style={styles.leaveTypeRow}>
                <Ionicons name={LEAVE_TYPE_ICONS[item.leave_type] || 'ellipse'} size={16} color={colors.primary} />
                <Text style={styles.leaveType}>{item.leave_type} Leave</Text>
              </View>
              <Text style={styles.leaveDates}>
                {new Date(item.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {item.start_date !== item.end_date && ` — ${new Date(item.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.badge, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={12} color={s.text} />
                <Text style={[styles.badgeText, { color: s.text }]}>{item.status}</Text>
              </View>
              <Text style={styles.daysCount}>{item.days} day{item.days > 1 ? 's' : ''}</Text>
            </View>
          </View>

          <Text style={styles.leaveReason} numberOfLines={2}>{item.reason}</Text>

          {item.review_note && (
            <View style={styles.reviewNoteRow}>
              <Ionicons name="chatbubble-outline" size={12} color={colors.textTertiary} />
              <Text style={styles.reviewNote}>{item.review_note}</Text>
            </View>
          )}

          {item.status === 'pending' && (
            <TouchableOpacity onPress={() => handleCancel(item.id)} style={styles.cancelBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={styles.cancelText}>Cancel Request</Text>
            </TouchableOpacity>
          )}
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

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;

  return (
    <View style={styles.container}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{leaves.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.success }]}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowForm(true)} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leaves}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeaves(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No Leave Requests</Text>
            <Text style={styles.emptyDesc}>Tap "Apply" to submit a leave request</Text>
          </View>
        }
      />

      {/* Leave Application Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Leave Type</Text>
              <View style={styles.typeSelector}>
                {leaveTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, form.leave_type === type && styles.typeChipActive]}
                    onPress={() => setForm({ ...form, leave_type: type })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={LEAVE_TYPE_ICONS[type]} size={16} color={form.leave_type === type ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.typeChipText, form.leave_type === type && styles.typeChipTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={form.start_date ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {form.start_date
                      ? new Date(form.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Select'}
                  </Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={form.start_date ? new Date(form.start_date + 'T00:00:00') : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    onChange={(event, date) => {
                      setShowStartPicker(Platform.OS === 'ios');
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setForm({ ...form, start_date: `${y}-${m}-${d}` });
                      }
                    }}
                    style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                  />
                )}
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={form.end_date ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {form.end_date
                      ? new Date(form.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Select'}
                  </Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={form.end_date ? new Date(form.end_date + 'T00:00:00') : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    minimumDate={form.start_date ? new Date(form.start_date + 'T00:00:00') : undefined}
                    onChange={(event, date) => {
                      setShowEndPicker(Platform.OS === 'ios');
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setForm({ ...form, end_date: `${y}-${m}-${d}` });
                      }
                    }}
                    style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                  />
                )}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.reason}
                onChangeText={(v) => setForm({ ...form, reason: v })}
                placeholder="Describe your reason for leave..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Submit Application</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  statChip: {
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignItems: 'center', flex: 1, ...shadows.sm,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 1 },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, borderRadius: radius.md,
    ...shadows.sm,
  },
  applyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // List
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  leaveCard: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderRadius: radius.md, marginBottom: spacing.md,
    overflow: 'hidden', ...shadows.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  leaveInfo: { flex: 1 },
  leaveTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaveType: { fontSize: 15, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  leaveDates: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  daysCount: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontWeight: '500' },
  leaveReason: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reviewNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm, backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.sm },
  reviewNote: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', flex: 1, lineHeight: 16 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing.md, alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.sm, backgroundColor: colors.dangerLight,
  },
  cancelText: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textTertiary, marginTop: spacing.md },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeaderBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalCloseBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalContent: { padding: spacing.xxl },
  formGroup: { marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, letterSpacing: 0.2 },
  input: {
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    fontSize: 15, color: colors.text, borderWidth: 1.5, borderColor: colors.border,
  },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateButton: {
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderWidth: 1.5, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dateButtonText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  dateButtonPlaceholder: { fontSize: 15, color: colors.textTertiary },
  iosPicker: { marginTop: spacing.sm },
  textArea: { height: 110, paddingTop: 14 },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing.md, ...shadows.md,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
