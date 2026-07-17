import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

export default function EmployeesScreen({ navigation }) {
  const { user } = useAuth();
  const canCreateEmployees = user?.permissions?.includes('employee.create');
  const canResetPasswords = user?.roles?.includes('org_admin');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [defaultOrgStructure, setDefaultOrgStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    department: '',
    designation: '',
    phone: '',
    role: 'employee',
  });
  const [resetModalVisible, setResetModalVisible] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadEmployees = async () => {
    try {
      const [employeeData, departmentData, designationData] = await Promise.all([
        api.getEmployees(), api.getDepartments(), api.getDesignations(),
      ]);
      setEmployees(employeeData.employees || []);
      setDepartments(departmentData.departments || []);
      setDefaultOrgStructure(departmentData.defaultStructure || []);
      setDesignations(designationData.designations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const departmentOptions = [...new Set([
    ...defaultOrgStructure.map(item => item.name),
    ...departments.filter(item => item.isActive !== false).map(item => item.name),
  ])].sort();
  const selectedDepartment = departments.find(item => item.name === form.department);
  const designationOptions = form.department ? [...new Set([
    ...(defaultOrgStructure.find(item => item.name === form.department)?.designations || []),
    ...designations.filter(item => item.isActive !== false && item.departmentId === selectedDepartment?.id).map(item => item.name),
  ])].sort() : [];

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
    }, [])
  );

  const resetForm = () => {
    setForm({
      employee_id: '',
      name: '',
      email: '',
      password: '',
      department: '',
      designation: '',
      phone: '',
      role: 'employee',
    });
  };

  const handleAdd = async () => {
    if (!form.employee_id || !form.name || !form.email || !form.password) {
      Alert.alert('Error', 'Employee ID, name, email, and password are required');
      return;
    }
    setSaving(true);
    try {
      await api.createEmployee(form);
      setModalVisible(false);
      resetForm();
      loadEmployees();
      Alert.alert('Success', 'Employee added successfully');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      await api.resetPassword(resetModalVisible.id, newPassword);
      setResetModalVisible(null);
      setNewPassword('');
      Alert.alert('Success', `Password reset for ${resetModalVisible.name}. They will be required to change it on next login.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setResetting(false);
    }
  };

  const renderEmployee = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('EmployeeDetailPage', { employeeId: item.id, employeeName: item.name })}
      onLongPress={() => {
        if (!canResetPasswords) return;
        setResetModalVisible(item);
        setNewPassword('');
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.empName}>{item.name}</Text>
        <Text style={styles.empMeta}>{item.employee_id} · {item.department}</Text>
        <Text style={styles.empMeta}>{item.designation}</Text>
      </View>
      <View style={[styles.roleBadge, item.roles?.includes('org_admin') ? styles.adminBadge : styles.employeeBadge]}>
        <Text style={[styles.roleText, item.roles?.includes('org_admin') ? styles.adminText : styles.employeeText]}>
          {(item.roles?.[0] || item.role || 'employee').replace(/_/g, ' ')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {canCreateEmployees && <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
        <Ionicons name="person-add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>Add Employee</Text>
      </TouchableOpacity>}

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderEmployee}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEmployees(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No employees found</Text>
        }
      />

      {/* Add Employee Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Employee</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <FormField label="Employee ID *" value={form.employee_id} onChangeText={(v) => setForm({ ...form, employee_id: v })} placeholder="e.g. ARC-006" />
            <FormField label="Full Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Enter full name" />
            <FormField label="Email *" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="Enter email" keyboardType="email-address" autoCapitalize="none" />
            <FormField label="Password *" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} placeholder="Min 6 characters" secureTextEntry />

            <PickerField
              label="Department"
              value={form.department}
              options={departmentOptions}
              placeholder="Select Department"
              onSelect={(v) => setForm({ ...form, department: v, designation: '' })}
            />
            <PickerField
              label="Designation"
              value={form.designation}
              options={designationOptions}
              placeholder={form.department ? 'Select Designation' : 'Select Department First'}
              onSelect={(v) => setForm({ ...form, designation: v })}
            />
            <FormField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="Phone number" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Access Role</Text>
            <Text style={styles.resetHint}>Employee — elevated roles are assigned from the secured web Role Management page.</Text>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Employee</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal visible={!!resetModalVisible} animationType="slide" transparent>
        <View style={styles.resetOverlay}>
          <View style={styles.resetContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setResetModalVisible(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {resetModalVisible && (
              <View style={{ padding: spacing.lg }}>
                <Text style={styles.resetEmpName}>{resetModalVisible.name}</Text>
                <Text style={styles.resetEmpMeta}>{resetModalVisible.employee_id} · {resetModalVisible.email}</Text>
                <FormField
                  label="New Password *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min 6 characters"
                  secureTextEntry
                />
                <Text style={styles.resetHint}>Employee will be forced to change password on next login.</Text>
                <TouchableOpacity style={styles.resetBtn} onPress={handleResetPassword} disabled={resetting} activeOpacity={0.8}>
                  {resetting ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="key" size={18} color="#fff" />
                      <Text style={styles.resetBtnText}>Reset Password</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormField({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textTertiary} {...props} />
    </View>
  );
}

function PickerField({ label, value, options, placeholder, onSelect }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => { setVisible(true); setSearch(''); }}
        activeOpacity={0.7}
      >
        <Text style={[{ fontSize: 15 }, value ? { color: colors.text } : { color: colors.textTertiary }]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{placeholder}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <TextInput
              style={styles.input}
              placeholder="Search..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, value === item && styles.pickerItemActive]}
                onPress={() => { onSelect(item); setVisible(false); }}
              >
                <Text style={[styles.pickerItemText, value === item && styles.pickerItemActiveText]}>{item}</Text>
                {value === item && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No results</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, marginHorizontal: spacing.lg, marginTop: spacing.lg,
    paddingVertical: 12, borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    padding: spacing.lg, borderRadius: 12, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  info: { flex: 1 },
  empName: { fontSize: 15, fontWeight: '600', color: colors.text },
  empMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  adminBadge: { backgroundColor: colors.purpleLight },
  employeeBadge: { backgroundColor: colors.primaryLight },
  roleText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  adminText: { color: colors.purple },
  employeeText: { color: colors.primary },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalBody: { padding: spacing.lg },
  field: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text,
  },
  roleSelector: { flexDirection: 'row', gap: 10, marginBottom: spacing.xl },
  roleOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card,
  },
  roleActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleOptionText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  roleActiveText: { color: colors.primary },
  submitBtn: {
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Picker
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 4,
  },
  pickerItemActive: { backgroundColor: colors.primaryLight },
  pickerItemText: { fontSize: 15, color: colors.text },
  pickerItemActiveText: { fontWeight: '600', color: colors.primary },
  // Reset password modal
  resetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  resetContent: {
    backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  resetEmpName: { fontSize: 17, fontWeight: '700', color: colors.text },
  resetEmpMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  resetHint: { fontSize: 12, color: colors.textTertiary, marginBottom: spacing.lg, marginTop: -8 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#d97706', paddingVertical: 14, borderRadius: 10,
  },
  resetBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
