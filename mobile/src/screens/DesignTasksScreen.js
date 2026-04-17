import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bg: '#fffbeb', icon: 'time-outline' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#eff6ff', icon: 'construct-outline' },
  completed: { label: 'Done', color: '#10b981', bg: '#ecfdf5', icon: 'checkmark-circle-outline' },
};

const CATEGORY_COLORS = {
  national: '#ef4444',
  festival: '#8b5cf6',
  religious: '#f59e0b',
  cultural: '#14b8a6',
};

export default function DesignTasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.getMyDesignTasks(2083);
      setTasks(data.tasks || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const onRefresh = () => { setRefreshing(true); fetchTasks(); };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  async function handleStatusToggle(task) {
    const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending';
    try {
      await api.updateDesignTaskStatus(task.id, nextStatus);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    } catch {}
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  }

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const renderTask = ({ item }) => {
    const sc = STATUS_CONFIG[item.status];
    const days = daysUntil(item.event_date);
    const catColor = CATEGORY_COLORS[item.category] || '#64748b';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => handleStatusToggle(item)}>
        <View style={[styles.catStripe, { backgroundColor: catColor }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.eventName} numberOfLines={1}>{item.event_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={12} color={sc.color} />
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>
          <View style={styles.cardMeta}>
            {item.event_date ? (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color="#64748b" />
                <Text style={styles.metaText}>
                  {new Date(item.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                {days !== null && (
                  <Text style={[styles.daysBadge, days <= 3 && days >= 0 ? styles.daysUrgent : days < 0 ? styles.daysPast : null]}>
                    {days > 0 ? `${days}d` : days === 0 ? 'Today' : `${Math.abs(days)}d ago`}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color="#cbd5e1" />
                <Text style={[styles.metaText, { color: '#cbd5e1' }]}>No date set</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <View style={[styles.catDot, { backgroundColor: catColor }]} />
              <Text style={[styles.metaText, { textTransform: 'capitalize' }]}>{item.category}</Text>
            </View>
          </View>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          ) : null}
          {item.notification_sent ? (
            <View style={styles.notifiedRow}>
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={styles.notifiedText}>Notified</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'in_progress', label: 'Active' },
          { key: 'completed', label: 'Done' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label} ({counts[f.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>Tap a task to cycle status: Pending → In Progress → Done</Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="color-palette-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No design tasks assigned to you</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  list: { padding: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  catStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  daysBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 2,
  },
  daysUrgent: { color: '#ef4444' },
  daysPast: { color: '#94a3b8' },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  description: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    lineHeight: 17,
  },
  notifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  notifiedText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
