import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing } from '../theme';

const STATUS_COLORS = {
  pending: { bg: '#fef3c7', text: '#d97706', label: 'Pending' },
  approved: { bg: '#d1fae5', text: '#059669', label: 'Approved' },
  rejected: { bg: '#fee2e2', text: '#dc2626', label: 'Rejected' },
};

export default function LeaveRequestsScreen() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadLeaves = async () => {
    try {
      const data = await api.getAllLeaves(filter === 'all' ? '' : filter);
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadLeaves();
    }, [filter])
  );

  const handleReview = async (status) => {
    if (!reviewModal) return;
    setActionLoading(true);
    try {
      await api.reviewLeave(reviewModal.id, status, reviewNote);
      setReviewModal(null);
      setReviewNote('');
      loadLeaves();
      Alert.alert('Success', `Leave ${status}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderLeave = ({ item }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={item.status === 'pending' ? 0.7 : 1}
        onPress={() => {
          if (item.status === 'pending') {
            setReviewModal(item);
            setReviewNote('');
          }
        }}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.name}</Text>
            <Text style={styles.empCode}>{item.emp_code} · {item.department}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Type</Text>
              <Text style={styles.fieldValue}>{item.leave_type}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Days</Text>
              <Text style={styles.fieldValue}>{item.days}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>From</Text>
              <Text style={styles.fieldValue}>{item.start_date}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>To</Text>
              <Text style={styles.fieldValue}>{item.end_date}</Text>
            </View>
          </View>
          <Text style={styles.fieldLabel}>Reason</Text>
          <Text style={styles.reason}>{item.reason}</Text>
        </View>

        {item.status === 'pending' && (
          <View style={styles.cardActions}>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            <Text style={styles.tapHint}>Tap to review</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterActiveText]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLeave}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeaves(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} leave requests</Text>
            </View>
          }
        />
      )}

      {/* Review Modal */}
      <Modal visible={!!reviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Leave Request</Text>
              <TouchableOpacity onPress={() => setReviewModal(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {reviewModal && (
              <View style={styles.modalBody}>
                <Text style={styles.modalEmpName}>{reviewModal.name}</Text>
                <Text style={styles.modalMeta}>{reviewModal.emp_code} · {reviewModal.department}</Text>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoLabel}>Type: <Text style={styles.modalInfoValue}>{reviewModal.leave_type}</Text></Text>
                  <Text style={styles.modalInfoLabel}>Days: <Text style={styles.modalInfoValue}>{reviewModal.days}</Text></Text>
                  <Text style={styles.modalInfoLabel}>From: <Text style={styles.modalInfoValue}>{reviewModal.start_date}</Text></Text>
                  <Text style={styles.modalInfoLabel}>To: <Text style={styles.modalInfoValue}>{reviewModal.end_date}</Text></Text>
                  <Text style={styles.modalInfoLabel}>Reason: <Text style={styles.modalInfoValue}>{reviewModal.reason}</Text></Text>
                </View>

                <Text style={styles.noteLabel}>Review Note (optional)</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note..."
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReview('rejected')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Ionicons name="close-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleReview('approved')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterActiveText: { color: '#fff' },
  list: { padding: spacing.lg, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  empName: { fontSize: 15, fontWeight: '700', color: colors.text },
  empCode: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { padding: spacing.md },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 2 },
  fieldValue: { fontSize: 13, color: colors.text, fontWeight: '500', textTransform: 'capitalize' },
  reason: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  tapHint: { fontSize: 11, color: colors.textTertiary },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: colors.textTertiary },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { padding: spacing.lg },
  modalEmpName: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 12 },
  modalInfo: { gap: 6, marginBottom: 16 },
  modalInfoLabel: { fontSize: 13, color: colors.textSecondary },
  modalInfoValue: { color: colors.text, fontWeight: '600' },
  noteLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn: { backgroundColor: '#dc2626' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
