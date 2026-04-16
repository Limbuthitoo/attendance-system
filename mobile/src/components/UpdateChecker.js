import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking, Platform, BackHandler } from 'react-native';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.3:3001/api';
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

export default function UpdateChecker({ children }) {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  // Block back button for mandatory updates
  useEffect(() => {
    if (updateInfo?.is_mandatory && !dismissed) {
      const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => handler.remove();
    }
  }, [updateInfo, dismissed]);

  async function checkForUpdate() {
    try {
      const res = await fetch(`${API_BASE}/app-update/check?current_version=${APP_VERSION}`);
      const data = await res.json();
      if (data.update_available) {
        setUpdateInfo(data);
      }
    } catch {
      // Silently fail — don't block app usage if server unreachable
    }
  }

  function handleUpdate() {
    const downloadUrl = `${API_BASE}/app-update/download`;
    Linking.openURL(downloadUrl);
  }

  function handleDismiss() {
    if (!updateInfo?.is_mandatory) {
      setDismissed(true);
    }
  }

  const showModal = updateInfo && !dismissed;

  return (
    <>
      {children}
      {showModal && Platform.OS === 'android' && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>📱</Text>
              </View>
              <Text style={styles.title}>Update Available</Text>
              <Text style={styles.version}>Version {updateInfo.version}</Text>

              {updateInfo.release_notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>What's New:</Text>
                  <Text style={styles.notesText}>{updateInfo.release_notes}</Text>
                </View>
              ) : null}

              {updateInfo.is_mandatory && (
                <View style={styles.mandatoryBox}>
                  <Text style={styles.mandatoryText}>This is a required update. Please install it to continue.</Text>
                </View>
              )}

              <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.8}>
                <Text style={styles.updateBtnText}>Download & Install</Text>
              </TouchableOpacity>

              {!updateInfo.is_mandatory && (
                <TouchableOpacity style={styles.laterBtn} onPress={handleDismiss} activeOpacity={0.7}>
                  <Text style={styles.laterBtnText}>Later</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  mandatoryBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginBottom: 16,
  },
  mandatoryText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '500',
  },
  updateBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
});
