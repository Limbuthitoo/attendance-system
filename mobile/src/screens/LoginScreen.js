import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image, StatusBar, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadows, radius } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [orgOptions, setOrgOptions] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password, selectedOrg || undefined);
    } catch (err) {
      if (err.organizations && err.organizations.length > 0) {
        setOrgOptions(err.organizations);
        setSelectedOrg(err.organizations[0].slug);
      } else {
        Alert.alert('Login Failed', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Dark branded header */}
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandTitle}>Attendance Management</Text>
          <Text style={styles.brandSubtitle}>Sign in to your account</Text>
        </View>
      </View>

      {/* Form card overlapping the header */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={secureEntry}
              />
              <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)} style={styles.eyeBtn}>
                <Ionicons name={secureEntry ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {orgOptions && (
            <View style={styles.orgPicker}>
              <Text style={styles.orgPickerLabel}>
                <Ionicons name="business-outline" size={14} color="#92400e" /> Select Organization
              </Text>
              {orgOptions.map(org => (
                <TouchableOpacity
                  key={org.slug}
                  style={[styles.orgOption, selectedOrg === org.slug && styles.orgOptionActive]}
                  onPress={() => setSelectedOrg(org.slug)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={selectedOrg === org.slug ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedOrg === org.slug ? colors.primary : colors.textTertiary}
                  />
                  <Text style={[styles.orgOptionText, selectedOrg === org.slug && styles.orgOptionTextActive]}>{org.name}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.orgPickerHint}>Your email exists in multiple organizations. Select one and sign in again.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.buttonText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Archisys Innovations Pvt. Ltd.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBg: {
    backgroundColor: colors.headerDark,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 60,
    paddingHorizontal: spacing.xxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 52,
    marginBottom: spacing.lg,
    tintColor: '#ffffff',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textInverse,
    marginTop: spacing.sm,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: spacing.xs,
  },
  formWrapper: {
    flex: 1,
    marginTop: -28,
    paddingHorizontal: spacing.xl,
  },
  form: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    ...shadows.lg,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputIcon: {
    paddingLeft: spacing.lg,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: 15,
    color: colors.text,
  },
  eyeBtn: {
    paddingRight: spacing.lg,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: spacing.xxxl,
  },
  orgPicker: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  orgPickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: spacing.md,
  },
  orgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  orgOptionActive: {
    backgroundColor: '#eff6ff',
  },
  orgOptionText: {
    fontSize: 14,
    color: colors.text,
  },
  orgOptionTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  orgPickerHint: {
    fontSize: 11,
    color: '#92400e',
    marginTop: spacing.sm,
  },
});
