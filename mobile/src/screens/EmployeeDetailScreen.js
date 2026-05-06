import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
  TouchableOpacity, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

export default function EmployeeDetailScreen({ route }) {
  const { employeeId, employeeName } = route.params;
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');

  const loadEmployee = async () => {
    try {
      const data = await api.getEmployee(employeeId);
      setEmployee(data.employee || data);
    } catch (err) {
      console.error('Failed to load employee:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmployee();
  }, [employeeId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const sections = [
    { key: 'personal', label: 'Personal', icon: 'person-outline' },
    { key: 'employment', label: 'Work', icon: 'briefcase-outline' },
    { key: 'bank', label: 'Bank & Tax', icon: 'card-outline' },
    { key: 'emergency', label: 'Emergency', icon: 'call-outline' },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!employee) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.errorText}>Employee not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEmployee(); }} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{employee.name?.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{employee.name}</Text>
        <Text style={styles.email}>{employee.email}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>{employee.employee_id || employee.employeeCode}</Text>
          </View>
          <View style={[styles.metaBadge, { backgroundColor: employee.role === 'admin' ? colors.purpleLight : colors.primaryLight }]}>
            <Text style={[styles.metaText, { color: employee.role === 'admin' ? colors.purple : colors.primary }]}>
              {employee.role}
            </Text>
          </View>
          {employee.isActive === false && (
            <View style={[styles.metaBadge, { backgroundColor: colors.dangerLight }]}>
              <Text style={[styles.metaText, { color: colors.danger }]}>Inactive</Text>
            </View>
          )}
        </View>
      </View>

      {/* Section tabs */}
      <View style={styles.tabBar}>
        {sections.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, activeSection === s.key && styles.tabActive]}
            onPress={() => setActiveSection(s.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={s.icon}
              size={16}
              color={activeSection === s.key ? colors.primary : colors.textTertiary}
            />
            <Text style={[styles.tabLabel, activeSection === s.key && styles.tabLabelActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeSection === 'personal' && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>Personal Information</Text>
          <InfoRow icon="business-outline" label="Department" value={employee.department} />
          <InfoRow icon="briefcase-outline" label="Designation" value={employee.designation} />
          <InfoRow icon="call-outline" label="Phone" value={employee.phone} />
          <InfoRow icon="male-female-outline" label="Gender" value={employee.gender} />
          <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
          <InfoRow icon="water-outline" label="Blood Group" value={employee.bloodGroup} />
          <InfoRow icon="heart-outline" label="Marital Status" value={employee.maritalStatus} />
          <InfoRow icon="location-outline" label="Address" value={employee.address} />
          <InfoRow icon="map-outline" label="City / State" value={[employee.city, employee.state].filter(Boolean).join(', ')} />
          <InfoRow icon="globe-outline" label="Country" value={employee.country} />
          <InfoRow icon="mail-outline" label="Zip Code" value={employee.zipCode} />
        </View>
      )}

      {activeSection === 'employment' && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>Employment Details</Text>
          <InfoRow icon="calendar-outline" label="Join Date" value={formatDate(employee.joinDate)} />
          <InfoRow icon="document-text-outline" label="Contract Type" value={employee.contractType} />
          <InfoRow icon="time-outline" label="Probation End" value={formatDate(employee.probationEndDate)} />
          <InfoRow icon="flag-outline" label="Status" value={employee.employmentStatus} />
          {employee.currentAssignment && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>Current Assignment</Text>
              <InfoRow icon="business-outline" label="Branch" value={employee.currentAssignment.branch?.name} />
              <InfoRow icon="time-outline" label="Shift" value={employee.currentAssignment.shift?.name} />
              <InfoRow icon="calendar-outline" label="Schedule" value={employee.currentAssignment.workSchedule?.name} />
            </>
          )}
          {employee.credentials?.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>Credentials</Text>
              {employee.credentials.map((cred) => (
                <InfoRow
                  key={cred.id}
                  icon="finger-print-outline"
                  label={cred.credentialType}
                  value={cred.label || 'Assigned'}
                />
              ))}
            </>
          )}
        </View>
      )}

      {activeSection === 'bank' && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>Bank Information</Text>
          <InfoRow icon="business-outline" label="Bank Name" value={employee.bankName} />
          <InfoRow icon="git-branch-outline" label="Branch" value={employee.bankBranch} />
          <InfoRow icon="card-outline" label="Account Number" value={employee.bankAccountNumber} />
          <InfoRow icon="person-outline" label="Account Name" value={employee.bankAccountName} />
          <View style={styles.divider} />
          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Tax Details</Text>
          <InfoRow icon="document-outline" label="PAN Number" value={employee.panNumber} />
          <InfoRow icon="shield-outline" label="SSF Number" value={employee.ssfNumber} />
        </View>
      )}

      {activeSection === 'emergency' && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>Emergency Contacts</Text>
          {employee.emergencyContacts?.length > 0 ? (
            employee.emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.contactRelation}>{contact.relationship}</Text>
                {contact.phone && (
                  <TouchableOpacity
                    style={styles.contactDetail}
                    onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                  >
                    <Ionicons name="call-outline" size={14} color={colors.primary} />
                    <Text style={[styles.contactDetailText, { color: colors.primary }]}>{contact.phone}</Text>
                  </TouchableOpacity>
                )}
                {contact.email && (
                  <TouchableOpacity
                    style={styles.contactDetail}
                    onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                  >
                    <Ionicons name="mail-outline" size={14} color={colors.primary} />
                    <Text style={[styles.contactDetailText, { color: colors.primary }]}>{contact.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No emergency contacts</Text>
          )}
        </View>
      )}

      {/* Documents */}
      {employee.documents?.length > 0 && (
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>Documents</Text>
          {employee.documents.map((doc) => (
            <View key={doc.id} style={styles.docRow}>
              <Ionicons name="document-outline" size={20} color={colors.primary} />
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text style={styles.docMeta}>
                  {doc.type} · {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : ''} · {formatDate(doc.uploadedAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.textTertiary, marginTop: spacing.md },

  // Header
  headerCard: {
    backgroundColor: colors.headerDark,
    borderRadius: radius.lg, padding: spacing.xxl,
    alignItems: 'center', marginBottom: spacing.lg,
    ...shadows.md,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.textInverse },
  name: { fontSize: 20, fontWeight: '800', color: colors.textInverse, letterSpacing: -0.3 },
  email: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  metaBadge: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: radius.full,
  },
  metaText: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderRadius: radius.lg, padding: spacing.xs,
    marginBottom: spacing.lg, ...shadows.sm,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  tabActive: { backgroundColor: colors.primaryLight },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  tabLabelActive: { color: colors.primary },

  // Detail card
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

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  // Emergency contacts
  contactCard: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contactName: { fontSize: 15, fontWeight: '600', color: colors.text },
  primaryBadge: {
    backgroundColor: colors.successLight, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: radius.full,
  },
  primaryText: { fontSize: 10, fontWeight: '700', color: colors.success },
  contactRelation: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  contactDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  contactDetailText: { fontSize: 13, color: colors.textSecondary },
  emptyText: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl },

  // Documents
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontWeight: '600', color: colors.text },
  docMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});
