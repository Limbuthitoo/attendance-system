import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const TYPE_CONFIG = {
  notice: { icon: 'megaphone-outline', color: colors.primary, bg: colors.primaryLight },
  leave: { icon: 'document-text-outline', color: colors.warningMuted, bg: colors.warningLight },
  design_task: { icon: 'color-palette-outline', color: colors.purple, bg: colors.purpleLight },
  system: { icon: 'settings-outline', color: colors.textSecondary, bg: colors.background },
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
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
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
          <Ionicons name="close" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
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
      {/* Actions bar */}
      {notifications.length > 0 && (
        <View style={styles.actions}>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>{unreadCount} unread</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.actionBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Read all</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>All Caught Up</Text>
            <Text style={styles.emptyDesc}>No new notifications</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  unreadPill: {
    backgroundColor: colors.primary, paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: radius.full,
  },
  unreadPillText: { fontSize: 11, fontWeight: '700', color: colors.textInverse },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  itemUnread: { backgroundColor: colors.primaryLight + '40' },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  title: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  titleBold: { fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontWeight: '500' },
  clearBtn: { padding: 4, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.background, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textTertiary },
  emptyDesc: { fontSize: 13, color: colors.textTertiary, marginTop: spacing.xs },
});
