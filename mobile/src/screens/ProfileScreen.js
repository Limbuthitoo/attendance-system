import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadows, radius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header card */}
      <View style={styles.headerCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)}</Text>
          </View>
          <View style={[styles.statusIndicator, { backgroundColor: colors.success }]} />
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.primary} />
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>

      {/* Employee details */}
      <View style={styles.detailCard}>
        <Text style={styles.sectionLabel}>Employee Information</Text>
        <InfoRow icon="card-outline" label="Employee ID" value={user?.employee_id} />
        <InfoRow icon="business-outline" label="Department" value={user?.department} />
        <InfoRow icon="briefcase-outline" label="Designation" value={user?.designation} />
      </View>

      {/* Quick actions */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation?.navigate?.('ChangePasswordPage')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="key-outline" size={18} color={colors.warning} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionLabel}>Change Password</Text>
            <Text style={styles.actionDesc}>Update your account password</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Archisys Innovations Pvt. Ltd. © {new Date().getFullYear()}</Text>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxxl },

  // Header card
  headerCard: {
    backgroundColor: colors.headerDark,
    borderRadius: radius.lg, padding: spacing.xxl,
    alignItems: 'center', marginBottom: spacing.lg,
    ...shadows.md,
  },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.textInverse },
  statusIndicator: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 3, borderColor: colors.headerDark,
  },
  name: { fontSize: 22, fontWeight: '800', color: colors.textInverse, letterSpacing: -0.3 },
  email: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, paddingHorizontal: 14,
    paddingVertical: 5, borderRadius: radius.full, marginTop: spacing.md,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },

  // Detail section
  detailCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 1 },

  // Actions
  actionsCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.xl, ...shadows.sm,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionContent: { flex: 1 },
  actionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  actionDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight, paddingVertical: 16,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '20',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.danger },

  footer: { textAlign: 'center', color: colors.textTertiary, fontSize: 11, marginTop: spacing.xxxl },
});
