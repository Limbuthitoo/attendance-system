import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing, shadows, radius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '' });

  const loadProfile = async () => {
    try {
      const data = await api.getMyProfile();
      setProfile(data.profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const startEdit = () => {
    setEditData({
      phone: profile?.phone || '',
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      bloodGroup: profile?.bloodGroup || '',
      maritalStatus: profile?.maritalStatus || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || '',
      zipCode: profile?.zipCode || '',
      bankName: profile?.bankName || '',
      bankBranch: profile?.bankBranch || '',
      bankAccountNumber: profile?.bankAccountNumber || '',
      bankAccountName: profile?.bankAccountName || '',
      panNumber: profile?.panNumber || '',
      ssfNumber: profile?.ssfNumber || '',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMyProfile(editData);
      setEditMode(false);
      loadProfile();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.relationship || !contactForm.phone) {
      Alert.alert('Error', 'Name, relationship, and phone are required');
      return;
    }
    try {
      await api.addEmergencyContact(contactForm);
      setContactModal(false);
      setContactForm({ name: '', relationship: '', phone: '', email: '' });
      loadProfile();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add contact');
    }
  };

  const handleDeleteContact = (contactId, contactName) => {
    Alert.alert('Delete Contact', `Remove ${contactName}?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteEmergencyContact(contactId);
            loadProfile();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor={colors.primary} />
      }
    >
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {activeSection === 'personal' && (
            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Personal Information</Text>
                {!editMode && (
                  <TouchableOpacity onPress={startEdit} activeOpacity={0.7}>
                    <Text style={styles.editBtn}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <InfoRow icon="card-outline" label="Employee ID" value={profile?.employee_id} />
              <InfoRow icon="business-outline" label="Department" value={profile?.department} />
              <InfoRow icon="briefcase-outline" label="Designation" value={profile?.designation} />
              {editMode ? (
                <>
                  <EditField label="Phone" value={editData.phone} onChangeText={(v) => setEditData({...editData, phone: v})} keyboardType="phone-pad" />
                  <EditField label="Date of Birth (YYYY-MM-DD)" value={editData.dateOfBirth} onChangeText={(v) => setEditData({...editData, dateOfBirth: v})} />
                  <EditField label="Blood Group" value={editData.bloodGroup} onChangeText={(v) => setEditData({...editData, bloodGroup: v})} />
                  <EditField label="Gender" value={editData.gender} onChangeText={(v) => setEditData({...editData, gender: v})} />
                  <EditField label="Marital Status" value={editData.maritalStatus} onChangeText={(v) => setEditData({...editData, maritalStatus: v})} />
                  <EditField label="Address" value={editData.address} onChangeText={(v) => setEditData({...editData, address: v})} />
                  <EditField label="City" value={editData.city} onChangeText={(v) => setEditData({...editData, city: v})} />
                  <EditField label="State" value={editData.state} onChangeText={(v) => setEditData({...editData, state: v})} />
                  <EditField label="Country" value={editData.country} onChangeText={(v) => setEditData({...editData, country: v})} />
                  <EditField label="Zip Code" value={editData.zipCode} onChangeText={(v) => setEditData({...editData, zipCode: v})} />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditMode(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <InfoRow icon="call-outline" label="Phone" value={profile?.phone} />
                  <InfoRow icon="calendar-outline" label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
                  <InfoRow icon="water-outline" label="Blood Group" value={profile?.bloodGroup} />
                  <InfoRow icon="heart-outline" label="Marital Status" value={profile?.maritalStatus} />
                  <InfoRow icon="location-outline" label="Address" value={profile?.address} />
                  <InfoRow icon="map-outline" label="City" value={[profile?.city, profile?.state].filter(Boolean).join(', ')} />
                  <InfoRow icon="globe-outline" label="Country" value={profile?.country} />
                </>
              )}
            </View>
          )}

          {activeSection === 'employment' && (
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>Employment Details</Text>
              <InfoRow icon="calendar-outline" label="Join Date" value={formatDate(profile?.joinDate)} />
              <InfoRow icon="document-text-outline" label="Contract Type" value={profile?.contractType} />
              <InfoRow icon="time-outline" label="Probation End" value={formatDate(profile?.probationEndDate)} />
              <InfoRow icon="flag-outline" label="Status" value={profile?.employmentStatus} />
              {profile?.currentAssignment && (
                <>
                  <InfoRow icon="business-outline" label="Branch" value={profile.currentAssignment.branch?.name} />
                  <InfoRow icon="time-outline" label="Shift" value={profile.currentAssignment.shift?.name} />
                  <InfoRow icon="calendar-outline" label="Schedule" value={profile.currentAssignment.workSchedule?.name} />
                </>
              )}
            </View>
          )}

          {activeSection === 'bank' && (
            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Bank Information</Text>
                {!editMode && (
                  <TouchableOpacity onPress={startEdit} activeOpacity={0.7}>
                    <Text style={styles.editBtn}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editMode ? (
                <>
                  <EditField label="Bank Name" value={editData.bankName} onChangeText={(v) => setEditData({...editData, bankName: v})} />
                  <EditField label="Bank Branch" value={editData.bankBranch} onChangeText={(v) => setEditData({...editData, bankBranch: v})} />
                  <EditField label="Account Number" value={editData.bankAccountNumber} onChangeText={(v) => setEditData({...editData, bankAccountNumber: v})} />
                  <EditField label="Account Name" value={editData.bankAccountName} onChangeText={(v) => setEditData({...editData, bankAccountName: v})} />
                  <EditField label="PAN Number" value={editData.panNumber} onChangeText={(v) => setEditData({...editData, panNumber: v})} />
                  <EditField label="SSF Number" value={editData.ssfNumber} onChangeText={(v) => setEditData({...editData, ssfNumber: v})} />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditMode(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <InfoRow icon="business-outline" label="Bank Name" value={profile?.bankName} />
                  <InfoRow icon="git-branch-outline" label="Branch" value={profile?.bankBranch} />
                  <InfoRow icon="card-outline" label="Account Number" value={profile?.bankAccountNumber} />
                  <InfoRow icon="person-outline" label="Account Name" value={profile?.bankAccountName} />
                  <View style={styles.divider} />
                  <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Tax Details</Text>
                  <InfoRow icon="document-outline" label="PAN Number" value={profile?.panNumber} />
                  <InfoRow icon="shield-outline" label="SSF Number" value={profile?.ssfNumber} />
                </>
              )}
            </View>
          )}

          {activeSection === 'emergency' && (
            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Emergency Contacts</Text>
                <TouchableOpacity onPress={() => setContactModal(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {profile?.emergencyContacts?.length > 0 ? (
                profile.emergencyContacts.map((contact) => (
                  <View key={contact.id} style={styles.contactCard}>
                    <View style={styles.contactHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        {contact.isPrimary && (
                          <View style={[styles.primaryBadge, { alignSelf: 'flex-start', marginTop: 2 }]}>
                            <Text style={styles.primaryText}>Primary</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteContact(contact.id, contact.name)}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.contactRelation}>{contact.relationship}</Text>
                    {contact.phone && (
                      <View style={styles.contactDetail}>
                        <Ionicons name="call-outline" size={14} color={colors.textTertiary} />
                        <Text style={styles.contactDetailText}>{contact.phone}</Text>
                      </View>
                    )}
                    {contact.email && (
                      <View style={styles.contactDetail}>
                        <Ionicons name="mail-outline" size={14} color={colors.textTertiary} />
                        <Text style={styles.contactDetailText}>{contact.email}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No emergency contacts added</Text>
              )}
            </View>
          )}
        </>
      )}

      {/* Add Emergency Contact Modal */}
      <Modal visible={contactModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => setContactModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: spacing.lg }}>
              <EditField label="Name *" value={contactForm.name} onChangeText={(v) => setContactForm({...contactForm, name: v})} />
              <EditField label="Relationship *" value={contactForm.relationship} onChangeText={(v) => setContactForm({...contactForm, relationship: v})} placeholder="e.g. Father, Spouse" />
              <EditField label="Phone *" value={contactForm.phone} onChangeText={(v) => setContactForm({...contactForm, phone: v})} keyboardType="phone-pad" />
              <EditField label="Email" value={contactForm.email} onChangeText={(v) => setContactForm({...contactForm, email: v})} keyboardType="email-address" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddContact} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Add Contact</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

function EditField({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textTertiary}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxxl },

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

  loadingContainer: { paddingVertical: spacing.xxxxl, alignItems: 'center' },

  detailCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
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

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight, paddingVertical: 16,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '20',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.danger },

  footer: { textAlign: 'center', color: colors.textTertiary, fontSize: 11, marginTop: spacing.xxxl },

  // Section header with edit button
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  editBtn: { fontSize: 13, fontWeight: '700', color: colors.primary },

  // Edit fields
  editField: { marginBottom: spacing.md },
  editFieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  editInput: {
    backgroundColor: colors.background, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 15, color: colors.text,
  },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
});
