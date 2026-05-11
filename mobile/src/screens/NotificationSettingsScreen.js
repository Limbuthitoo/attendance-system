import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

const CHANNEL_ICONS = {
  LEAVE_UPDATES: 'calendar-outline',
  ATTENDANCE: 'time-outline',
  NOTICES: 'megaphone-outline',
  SYSTEM: 'settings-outline',
  BIRTHDAYS: 'gift-outline',
  PAYROLL: 'wallet-outline',
  REPORTS: 'document-text-outline',
  CRM: 'people-outline',
};

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'org'
  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    try {
      const prefsRes = await api.getPreferences();
      setPreferences(prefsRes.preferences);

      if (isAdmin) {
        const orgRes = await api.getOrgNotificationSettings();
        setOrgSettings(orgRes.settings);
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
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

  const togglePref = async (channel, field) => {
    const current = preferences[channel];
    const newValue = !current[field];
    const updated = {
      ...preferences,
      [channel]: { ...current, [field]: newValue },
    };
    setPreferences(updated);

    try {
      setSaving(true);
      await api.updatePreferences([{
        channel,
        pushEnabled: field === 'pushEnabled' ? newValue : current.pushEnabled,
        emailEnabled: field === 'emailEnabled' ? newValue : current.emailEnabled,
      }]);
    } catch (err) {
      // Revert on failure
      setPreferences(preferences);
      Alert.alert('Error', 'Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  const toggleOrgSetting = async (channel, field) => {
    const current = orgSettings[channel];
    const newValue = !current[field];
    const updated = {
      ...orgSettings,
      [channel]: { ...current, [field]: newValue },
    };
    setOrgSettings(updated);

    try {
      setSaving(true);
      await api.updateOrgNotificationSettings([{
        channel,
        pushEnabled: field === 'pushEnabled' ? newValue : current.pushEnabled,
        emailEnabled: field === 'emailEnabled' ? newValue : current.emailEnabled,
        quietHoursStart: current.quietHoursStart,
        quietHoursEnd: current.quietHoursEnd,
      }]);
    } catch (err) {
      setOrgSettings(orgSettings);
      Alert.alert('Error', 'Failed to update org setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderChannelCard = (channelKey, data, onToggle, showOrgBadge) => (
    <View key={channelKey} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBadge}>
          <Ionicons
            name={CHANNEL_ICONS[channelKey] || 'notifications-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.channelLabel}>{data.label}</Text>
          <Text style={styles.channelDesc}>{data.description}</Text>
        </View>
      </View>
      <View style={styles.toggleRow}>
        <View style={styles.toggleItem}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.toggleLabel}>Push</Text>
          <Switch
            value={data.pushEnabled}
            onValueChange={() => onToggle(channelKey, 'pushEnabled')}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={data.pushEnabled ? colors.primary : '#f4f3f4'}
            disabled={saving}
          />
        </View>
        <View style={styles.toggleItem}>
          <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.toggleLabel}>Email</Text>
          <Switch
            value={data.emailEnabled}
            onValueChange={() => onToggle(channelKey, 'emailEnabled')}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={data.emailEnabled ? colors.primary : '#f4f3f4'}
            disabled={saving}
          />
        </View>
      </View>
      {showOrgBadge && !data.pushEnabled && (
        <View style={styles.orgDisabledBadge}>
          <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
          <Text style={styles.orgDisabledText}>Disabled by organization</Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
      }
    >
      {isAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Preferences
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'org' && styles.tabActive]}
            onPress={() => setActiveTab('org')}
          >
            <Text style={[styles.tabText, activeTab === 'org' && styles.tabTextActive]}>
              Organization
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {activeTab === 'my' && preferences && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <Text style={styles.sectionSubtitle}>
            Choose which notifications you want to receive
          </Text>
          {Object.entries(preferences).map(([key, data]) =>
            renderChannelCard(key, data, togglePref, false)
          )}
        </View>
      )}

      {activeTab === 'org' && orgSettings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Settings</Text>
          <Text style={styles.sectionSubtitle}>
            Control notifications for all employees in your organization
          </Text>
          {Object.entries(orgSettings).map(([key, data]) =>
            renderChannelCard(key, data, toggleOrgSetting, false)
          )}
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardText: {
    flex: 1,
  },
  channelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  channelDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#e2e8f0',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
  },
  orgDisabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fef3c7',
    borderRadius: radius.sm,
  },
  orgDisabledText: {
    fontSize: 12,
    color: '#92400e',
  },
  savingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  savingText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
