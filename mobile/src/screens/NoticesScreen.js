import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
  Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const TYPE_CONFIG = {
  general: { icon: 'megaphone-outline', color: colors.primary, bg: colors.primaryLight, label: 'General' },
  official: { icon: 'document-text-outline', color: colors.textSecondary, bg: colors.background, label: 'Official' },
  event: { icon: 'sparkles-outline', color: colors.purple, bg: colors.purpleLight, label: 'Event' },
  urgent: { icon: 'alert-circle-outline', color: colors.danger, bg: colors.dangerLight, label: 'Urgent' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NoticesScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

  // Create notice state
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [createType, setCreateType] = useState('general');
  const [creating, setCreating] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      const data = await api.getNotices(100);
      setNotices(data.notices || []);
    } catch (err) {
      console.error('Fetch notices error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotices();
  };

  const handlePress = async (notice) => {
    setSelected(notice);
    // Mark related notification as read
    api.getNotice(notice.id).catch(() => {});
  };

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
    return (
      <TouchableOpacity
        style={[styles.card, item.type === 'urgent' && styles.cardUrgent]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{item.published_by_name || 'Admin'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !createBody.trim()) {
      Alert.alert('Error', 'Title and body are required');
      return;
    }
    setCreating(true);
    try {
      await api.createNotice({ title: createTitle.trim(), body: createBody.trim(), type: createType });
      setShowCreate(false);
      setCreateTitle('');
      setCreateBody('');
      setCreateType('general');
      fetchNotices();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create notice');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={notices.length === 0 ? styles.emptyContainer : { padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="megaphone-outline" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Notices</Text>
            <Text style={styles.emptyDesc}>Official notices will appear here</Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              {selected && (
                <View style={[styles.badge, { backgroundColor: TYPE_CONFIG[selected?.type]?.bg || '#eff6ff' }]}>
                  <Text style={[styles.badgeText, { color: TYPE_CONFIG[selected?.type]?.color || '#2563eb' }]}>
                    {TYPE_CONFIG[selected?.type]?.label || 'General'}
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <View style={styles.modalMeta}>
                <Ionicons name="person-outline" size={12} color="#94a3b8" />
                <Text style={styles.modalMetaText}>{selected?.published_by_name || 'Admin'}</Text>
                <Ionicons name="time-outline" size={12} color="#94a3b8" />
                <Text style={styles.modalMetaText}>
                  {selected ? new Date(selected.created_at).toLocaleString() : ''}
                </Text>
              </View>
              <Text style={styles.modalContent}>{selected?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Admin FAB */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create Notice Modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>New Notice</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Type selector */}
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeChip, createType === key && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                    onPress={() => setCreateType(key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cfg.icon} size={14} color={createType === key ? cfg.color : colors.textTertiary} />
                    <Text style={[styles.typeChipText, createType === key && { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="Notice title"
                placeholderTextColor={colors.textTertiary}
              />

              {/* Body */}
              <Text style={styles.fieldLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={createBody}
                onChangeText={setCreateBody}
                placeholder="Write your notice content..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />

              {/* Publish button */}
              <TouchableOpacity
                style={[styles.publishBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.7}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.publishBtnText}>Publish Notice</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    padding: spacing.lg, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardUrgent: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  iconWrap: {
    width: 42, height: 42, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardBody: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  metaText: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
  metaDot: { fontSize: 11, color: colors.border },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.background, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textTertiary },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },

  // Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: -0.3 },
  modalMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xl },
  modalMetaText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
  modalContent: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, paddingBottom: spacing.xxxl },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    ...shadows.lg, elevation: 6,
  },

  // Create form
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.lg },
  typeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text,
  },
  textArea: { height: 120, paddingTop: 12 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, marginTop: spacing.xl, marginBottom: spacing.xxxl,
  },
  publishBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
