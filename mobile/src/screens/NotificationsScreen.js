import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';

const TYPE_CONFIG = {
  notice: { icon: 'megaphone-outline', color: '#2563eb', bg: '#eff6ff' },
  leave: { icon: 'document-text-outline', color: '#f59e0b', bg: '#fffbeb' },
  design_task: { icon: 'color-palette-outline', color: '#8b5cf6', bg: '#f5f3ff' },
  system: { icon: 'settings-outline', color: '#64748b', bg: '#f8fafc' },
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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications(50);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handlePress = async (notif) => {
    if (!notif.is_read) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (notif.reference_type === 'notice' && notif.reference_id) {
      navigation.navigate('NoticesPage');
    }
  };

  const handleClear = (notif) => {
    Alert.alert('Clear Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await api.clearNotification(notif.id).catch(() => {});
          setNotifications(prev => prev.filter(n => n.id !== notif.id));
          if (!notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
        }
      },
    ]);
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive', onPress: async () => {
          await api.clearAllNotifications().catch(() => {});
          setNotifications([]);
          setUnreadCount(0);
        }
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    return (
      <TouchableOpacity
        style={[styles.item, !item.is_read && styles.itemUnread]}
        onPress={() => handlePress(item)}
        onLongPress={() => handleClear(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            {!item.is_read && <View style={styles.dot} />}
            <Text style={[styles.title, !item.is_read && styles.titleBold]} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={() => handleClear(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="#cbd5e1" />
        </TouchableOpacity>
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
      {/* Actions bar */}
      {notifications.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.actionBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color="#2563eb" />
            <Text style={styles.actionText}>Read all</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyDesc}>You're all caught up!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 16,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  itemUnread: { backgroundColor: '#eff6ff40' },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  title: { fontSize: 14, color: '#334155', flex: 1 },
  titleBold: { fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 17 },
  time: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  clearBtn: { padding: 4, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptyDesc: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },
});
