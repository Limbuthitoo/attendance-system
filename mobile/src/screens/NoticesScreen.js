import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchNotices = useCallback(async () => {
    try {
      const data = await api.getNotices(100);
      setNotices(data.notices);
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
});
