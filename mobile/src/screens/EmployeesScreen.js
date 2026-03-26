import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Modal, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { colors, spacing } from '../theme';

const DEPARTMENTS = [
  'Engineering', 'Design', 'Digital Marketing', 'Content & Media', 'SEO',
  'Sales', 'Human Resources', 'Finance', 'Operations', 'Quality Assurance',
  'DevOps', 'Product', 'Customer Support', 'Administration', 'Data & Analytics',
];

const DESIGNATIONS = [
  'CEO', 'CTO', 'COO', 'CFO', 'Director', 'Vice President',
  'Senior Manager', 'Manager', 'Assistant Manager', 'Team Lead',
  'Principal Engineer', 'Senior Software Engineer', 'Software Engineer', 'Junior Software Engineer',
  'Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'Mobile App Developer',
  'UI/UX Designer', 'Senior Designer', 'Graphic Designer', 'Motion Designer',
  'Digital Marketing Manager', 'Digital Marketing Executive',
  'SEO Manager', 'SEO Specialist', 'SEO Analyst',
  'Content Strategist', 'Senior Content Writer', 'Content Writer', 'Copywriter',
  'Social Media Manager', 'Social Media Executive',
  'PPC Specialist', 'Performance Marketing Manager', 'Email Marketing Specialist',
  'Business Development Manager', 'Business Development Executive',
  'Sales Manager', 'Sales Executive', 'Account Manager',
  'HR Manager', 'HR Executive', 'Recruiter',
  'Finance Manager', 'Accountant',
  'QA Lead', 'Senior QA Engineer', 'QA Engineer',
  'DevOps Engineer', 'System Administrator', 'Cloud Engineer',
  'Product Manager', 'Project Manager', 'Scrum Master',
  'Data Analyst', 'Data Scientist', 'Data Engineer',
  'Customer Support Manager', 'Customer Support Executive',
  'Office Administrator', 'Intern', 'Trainee',
];

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState([]);
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

  const loadEmployees = async () => {
    try {
      const data = await api.getEmployees();
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const renderEmployee = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.empName}>{item.name}</Text>
        <Text style={styles.empMeta}>{item.employee_id} · {item.department}</Text>
        <Text style={styles.empMeta}>{item.designation}</Text>
      </View>
      <View style={[styles.roleBadge, item.role === 'admin' ? styles.adminBadge : styles.employeeBadge]}>
        <Text style={[styles.roleText, item.role === 'admin' ? styles.adminText : styles.employeeText]}>
          {item.role}
        </Text>
      </View>
    </View>
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
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
        <Ionicons name="person-add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>Add Employee</Text>
      </TouchableOpacity>

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
              options={DEPARTMENTS}
              placeholder="Select Department"
              onSelect={(v) => setForm({ ...form, department: v })}
            />
            <PickerField
              label="Designation"
              value={form.designation}
              options={DESIGNATIONS}
              placeholder="Select Designation"
              onSelect={(v) => setForm({ ...form, designation: v })}
            />
            <FormField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="Phone number" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleOption, form.role === 'employee' && styles.roleActive]}
                onPress={() => setForm({ ...form, role: 'employee' })}
              >
                <Text style={[styles.roleOptionText, form.role === 'employee' && styles.roleActiveText]}>Employee</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, form.role === 'admin' && styles.roleActive]}
                onPress={() => setForm({ ...form, role: 'admin' })}
              >
                <Text style={[styles.roleOptionText, form.role === 'admin' && styles.roleActiveText]}>Admin</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Employee</Text>}
            </TouchableOpacity>
          </ScrollView>
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
});
