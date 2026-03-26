import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, ScrollView, RefreshControl, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api';
import { colors, spacing } from '../theme';

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

  const statusStyle = (status) => {
    const map = {
      pending: { bg: colors.warningLight, text: colors.warning },
      approved: { bg: colors.successLight, text: colors.success },
      rejected: { bg: colors.dangerLight, text: colors.danger },
    };
    return map[status] || { bg: '#f1f5f9', text: colors.textSecondary };
  };

  const leaveTypes = ['casual', 'sick', 'earned', 'unpaid', 'other'];

  const renderItem = ({ item }) => {
    const s = statusStyle(item.status);
    return (
      <View style={styles.leaveCard}>
        <View style={styles.leaveHeader}>
          <View>
            <Text style={styles.leaveType}>{item.leave_type} Leave</Text>
            <Text style={styles.leaveDates}>
              {new Date(item.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {item.start_date !== item.end_date && ` — ${new Date(item.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              {' · '}{item.days} day{item.days > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.text }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.leaveReason}>{item.reason}</Text>
        {item.review_note && (
          <Text style={styles.reviewNote}>Admin: {item.review_note}</Text>
        )}
        {item.status === 'pending' && (
          <TouchableOpacity onPress={() => handleCancel(item.id)} style={styles.cancelBtn}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
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
      {/* Apply Button */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Leaves</Text>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
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
          <Text style={styles.empty}>No leave requests</Text>
        }
      />

      {/* Leave Application Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.typeSelector}>
              {leaveTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, form.leave_type === type && styles.typeChipActive]}
                  onPress={() => setForm({ ...form, leave_type: type })}
                >
                  <Text style={[styles.typeChipText, form.leave_type === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={form.start_date ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {form.start_date
                  ? new Date(form.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select start date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={form.end_date ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {form.end_date
                  ? new Date(form.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select end date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
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

          <View style={styles.formGroup}>
            <Text style={styles.label}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.reason}
              onChangeText={(v) => setForm({ ...form, reason: v })}
              placeholder="Describe your reason..."
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Application</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  leaveCard: { backgroundColor: colors.white, borderRadius: 14, padding: spacing.lg, marginBottom: spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  leaveType: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  leaveDates: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  leaveReason: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  reviewNote: { fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', marginTop: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md, alignSelf: 'flex-start' },
  cancelText: { fontSize: 12, color: colors.danger, fontWeight: '500' },
  empty: { textAlign: 'center', color: colors.textTertiary, fontSize: 14, marginTop: spacing.xxxl },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalContent: { padding: spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  formGroup: { marginBottom: spacing.xl },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  input: { backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  dateButton: { backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButtonText: { fontSize: 15, color: colors.text },
  dateButtonPlaceholder: { fontSize: 15, color: colors.textTertiary },
  iosPicker: { marginTop: spacing.sm },
  textArea: { height: 100, paddingTop: 14 },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: spacing.md },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
