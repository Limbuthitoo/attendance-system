import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and send token to server.
 * Returns the Expo push token string or null.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Android notification channels — one per notification type
  if (Platform.OS === 'android') {
    const channels = [
      { id: 'leave-updates', name: 'Leave Updates', description: 'Leave applications, approvals, rejections' },
      { id: 'attendance', name: 'Attendance', description: 'Check-out reminders and anomalies' },
      { id: 'notices', name: 'Notices', description: 'Company announcements' },
      { id: 'system', name: 'System', description: 'System alerts and errors' },
      { id: 'birthdays', name: 'Birthdays & Anniversaries', description: 'Birthday and anniversary wishes' },
      { id: 'payroll', name: 'Payroll', description: 'Payslip and payroll alerts' },
      { id: 'reports', name: 'Reports', description: 'Generated report notifications' },
      { id: 'crm', name: 'CRM', description: 'CRM activity reminders' },
      { id: 'default', name: 'Default', description: 'General notifications' },
    ];

    for (const ch of channels) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        description: ch.description,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'default',
      });
    }
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;

    // Send token to server
    await api.registerPushToken(token, Device.modelName || Device.deviceName || 'Unknown');

    return token;
  } catch (err) {
    console.error('Failed to get push token:', err);
    return null;
  }
}

/**
 * Unregister push token from server (call on logout).
 */
export async function unregisterPushToken() {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.removePushToken(tokenData.data);
  } catch {
    // Silently fail
  }
}
