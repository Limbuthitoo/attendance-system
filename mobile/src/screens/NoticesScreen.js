import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';

const TYPE_CONFIG = {
  general: { icon: 'megaphone-outline', color: '#2563eb', bg: '#eff6ff', label: 'General' },
  official: { icon: 'document-text-outline', color: '#64748b', bg: '#f8fafc', label: 'Official' },
  event: { icon: 'sparkles-outline', color: '#8b5cf6', bg: '#f5f3ff', label: 'Event' },
  urgent: { icon: 'alert-circle-outline', color: '#ef4444', bg: '#fef2f2', label: 'Urgent' },
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        contentContainerStyle={notices.length === 0 ? styles.emptyContainer : { padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No notices</Text>
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
                <Ionicons name="close" size={22} color="#64748b" />
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9',
  },
  cardUrgent: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardBody: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 11, color: '#94a3b8' },
  metaDot: { fontSize: 11, color: '#cbd5e1' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptyDesc: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  closeBtn: { padding: 4 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  modalMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  modalMetaText: { fontSize: 12, color: '#94a3b8' },
  modalContent: { fontSize: 15, color: '#334155', lineHeight: 22, paddingBottom: 30 },
});
