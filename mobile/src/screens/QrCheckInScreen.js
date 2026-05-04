import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Dimensions, Platform, Vibration, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadows, radius } from '../theme';
import { api } from '../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCANNER_SIZE = SCREEN_WIDTH * 0.7;

/**
 * QR Check-In Screen
 *
 * Two modes:
 * 1. SCAN — Employee scans a location QR code displayed at the office
 * 2. SHOW — Employee shows their personal QR code on screen for a terminal to scan
 *
 * We lazy-load expo-camera to avoid crashes if the permission is denied or
 * the package isn't installed yet (graceful degradation).
 */
export default function QrCheckInScreen({ navigation }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('scan'); // 'scan' | 'show'
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { success, action, error }
  const [CameraModule, setCameraModule] = useState(null);

  // Show mode state
  const [myQr, setMyQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load camera module dynamically
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('expo-camera');
        setCameraModule(mod);
      } catch {
        setCameraModule(null);
      }
    })();
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!CameraModule) return;
    (async () => {
      const { status } = await CameraModule.Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, [CameraModule]);

  // Pulse animation for scan frame
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Countdown timer for personal QR code
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          setMyQr(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle barcode scanned
  const handleBarCodeScanned = useCallback(async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    Vibration.vibrate(100);

    try {
      const res = await api.scanLocationQr(data, null, null);
      setResult({
        success: true,
        action: res.action,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err.message || 'QR code is invalid or expired',
      });
    } finally {
      setProcessing(false);
    }
  }, [scanned, processing]);

  // Generate personal QR code
  const generateMyQr = async () => {
    setQrLoading(true);
    try {
      const res = await api.getMyQrCode();
      setMyQr(res);
      setCountdown(res.ttlSeconds || 30);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to generate QR code');
    } finally {
      setQrLoading(false);
    }
  };

  // Reset scanner
  const resetScan = () => {
    setScanned(false);
    setResult(null);
    setProcessing(false);
  };

  // ── Scan Mode ──────────────────────────────────────────────────────────

  const renderScanMode = () => {
    if (!CameraModule) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="camera-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.permissionTitle}>Camera Not Available</Text>
          <Text style={styles.permissionText}>
            Install expo-camera to enable QR scanning.{'\n'}
            You can still use "Show My QR" mode.
          </Text>
          <TouchableOpacity style={styles.switchBtn} onPress={() => setMode('show')}>
            <Text style={styles.switchBtnText}>Show My QR Code</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasPermission === null) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera access in your device settings to scan QR codes.
          </Text>
          <TouchableOpacity style={styles.switchBtn} onPress={() => setMode('show')}>
            <Text style={styles.switchBtnText}>Show My QR Instead</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (result) {
      return (
        <View style={styles.centerContent}>
          {result.success ? (
            <>
              <View style={[styles.resultIcon, { backgroundColor: colors.successLight || '#dcfce7' }]}>
                <Ionicons
                  name={result.action === 'check_in' ? 'log-in-outline' : 'log-out-outline'}
                  size={48}
                  color={colors.success}
                />
              </View>
              <Text style={styles.resultTitle}>
                {result.action === 'check_in' ? 'Checked In!' : 'Checked Out!'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {result.action === 'check_in'
                  ? 'Your attendance has been recorded.'
                  : 'See you tomorrow!'}
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.resultIcon, { backgroundColor: colors.dangerLight || '#fef2f2' }]}>
                <Ionicons name="close-circle-outline" size={48} color={colors.danger} />
              </View>
              <Text style={styles.resultTitle}>Failed</Text>
              <Text style={styles.resultSubtitle}>{result.error}</Text>
            </>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={resetScan}>
            <Ionicons name="refresh-outline" size={20} color={colors.white} />
            <Text style={styles.retryBtnText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const { CameraView } = CameraModule;

    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </Animated.View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            {processing ? (
              <View style={styles.scanStatus}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.scanStatusText}>Processing...</Text>
              </View>
            ) : (
              <Text style={styles.scanHint}>
                Point your camera at the QR code displayed at the office
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Show Mode (personal QR) ────────────────────────────────────────────

  const renderShowMode = () => {
    if (myQr && countdown > 0) {
      return (
        <View style={styles.centerContent}>
          <View style={styles.qrContainer}>
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={120} color={colors.primary} />
              <Text style={styles.qrToken}>{myQr.token?.substring(0, 16)}...</Text>
            </View>
          </View>
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>Expires in</Text>
            <Text style={[styles.countdownValue, countdown <= 10 && { color: colors.danger }]}>
              {countdown}s
            </Text>
          </View>
          <Text style={styles.showHint}>
            Show this to the QR terminal at your office
          </Text>
          <TouchableOpacity style={styles.refreshQrBtn} onPress={generateMyQr}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.refreshQrBtnText}>Generate New Code</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContent}>
        <Ionicons name="qr-code-outline" size={80} color={colors.textTertiary} />
        <Text style={styles.showTitle}>Personal QR Code</Text>
        <Text style={styles.showSubtitle}>
          Generate a time-limited QR code to show at the office terminal for check-in.
        </Text>
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={generateMyQr}
          disabled={qrLoading}
        >
          {qrLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="qr-code-outline" size={20} color={colors.white} />
          )}
          <Text style={styles.generateBtnText}>
            {qrLoading ? 'Generating...' : 'Generate QR Code'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'scan' && styles.modeBtnActive]}
          onPress={() => { setMode('scan'); resetScan(); }}
        >
          <Ionicons
            name="scan-outline"
            size={18}
            color={mode === 'scan' ? colors.white : colors.textSecondary}
          />
          <Text style={[styles.modeBtnText, mode === 'scan' && styles.modeBtnTextActive]}>
            Scan QR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'show' && styles.modeBtnActive]}
          onPress={() => setMode('show')}
        >
          <Ionicons
            name="qr-code-outline"
            size={18}
            color={mode === 'show' ? colors.white : colors.textSecondary}
          />
          <Text style={[styles.modeBtnText, mode === 'show' && styles.modeBtnTextActive]}>
            Show My QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {mode === 'scan' ? renderScanMode() : renderShowMode()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    ...shadows.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.white,
  },

  // Center content (permissions, results, show mode)
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  switchBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  switchBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },

  // Scanner
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  scanHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  scanStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanStatusText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Corner markers
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: 3, borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },

  // Result
  resultIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  resultSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },

  // Show mode
  showTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
  },
  showSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  generateBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },

  // QR display
  qrContainer: {
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  qrToken: {
    marginTop: spacing.sm,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textTertiary,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  countdownValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  showHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  refreshQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  refreshQrBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
