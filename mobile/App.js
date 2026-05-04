import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import UpdateChecker from './src/components/UpdateChecker';
import ErrorBoundary from './src/components/ErrorBoundary';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { api } from './src/api';

// ── Lazy-loaded screens ─────────────────────────────────────────────────────
const ChangePasswordScreen = lazy(() => import('./src/screens/ChangePasswordScreen'));
const AttendanceScreen = lazy(() => import('./src/screens/AttendanceScreen'));
const LeavesScreen = lazy(() => import('./src/screens/LeavesScreen'));
const EmployeesScreen = lazy(() => import('./src/screens/EmployeesScreen'));
const CalendarScreen = lazy(() => import('./src/screens/CalendarScreen'));
const LeaveRequestsScreen = lazy(() => import('./src/screens/LeaveRequestsScreen'));
const ProfileScreen = lazy(() => import('./src/screens/ProfileScreen'));
const NotificationsScreen = lazy(() => import('./src/screens/NotificationsScreen'));
const NoticesScreen = lazy(() => import('./src/screens/NoticesScreen'));
const EmployeeAttendanceScreen = lazy(() => import('./src/screens/EmployeeAttendanceScreen'));
const QrCheckInScreen = lazy(() => import('./src/screens/QrCheckInScreen'));

function ScreenFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
      <ActivityIndicator size="large" color="#1e40af" />
    </View>
  );
}

function withLazy(LazyComponent) {
  return function LazyWrapper(props) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<ScreenFallback />}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

const LazyChangePassword = withLazy(ChangePasswordScreen);
const LazyAttendance = withLazy(AttendanceScreen);
const LazyLeaves = withLazy(LeavesScreen);
const LazyEmployees = withLazy(EmployeesScreen);
const LazyCalendar = withLazy(CalendarScreen);
const LazyLeaveRequests = withLazy(LeaveRequestsScreen);
const LazyProfile = withLazy(ProfileScreen);
const LazyNotifications = withLazy(NotificationsScreen);
const LazyNotices = withLazy(NoticesScreen);
const LazyEmployeeAttendance = withLazy(EmployeeAttendanceScreen);
const LazyQrCheckIn = withLazy(QrCheckInScreen);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();

const navigationRef = React.createRef();

function MenuItem({ icon, label, description, onPress, color = '#1e40af' }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.menuIcon, { backgroundColor: color + '14' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        {description && <Text style={styles.menuDesc}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

function MenuScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <ScrollView style={styles.menuContainer} contentContainerStyle={styles.menuContent}>
      <Text style={styles.menuSection}>General</Text>
      <View style={styles.menuCard}>
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          description="Alerts & updates"
          onPress={() => navigation.navigate('NotificationsPage')}
          color="#dc2626"
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="megaphone-outline"
          label="Notices"
          description="Official notices & announcements"
          onPress={() => navigation.navigate('NoticesPage')}
          color="#1e40af"
        />
      </View>

      {isAdmin && (
        <>
          <Text style={styles.menuSection}>Administration</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="mail-outline"
              label="Leave Requests"
              description="Approve or reject requests"
              onPress={() => navigation.navigate('RequestsPage')}
              color="#f59e0b"
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="people-outline"
              label="Employees"
              description="Manage staff & accounts"
              onPress={() => navigation.navigate('EmployeesPage')}
              color="#10b981"
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="clipboard-outline"
              label="Employee Attendance"
              description="Daily attendance overview"
              onPress={() => navigation.navigate('EmployeeAttendancePage')}
              color="#6366f1"
            />
          </View>
        </>
      )}

      {/* App version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Archisys Attendance v{Constants.expoConfig?.version || '1.2.0'}</Text>
      </View>
    </ScrollView>
  );
}

function MenuStackScreen() {
  const { user } = useAuth();
  return (
    <MenuStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
        headerBackTitleVisible: false,
        headerTintColor: '#94a3b8',
      }}
    >
      <MenuStack.Screen name="MenuHome" component={MenuScreen} options={{ headerTitle: 'More' }} />
      <MenuStack.Screen name="NotificationsPage" component={LazyNotifications} options={{ headerTitle: 'Notifications' }} />
      <MenuStack.Screen name="NoticesPage" component={LazyNotices} options={{ headerTitle: 'Notices' }} />
      <MenuStack.Screen name="ProfilePage" component={LazyProfile} options={{ headerTitle: 'My Profile' }} />
      <MenuStack.Screen name="ChangePasswordPage" component={LazyChangePassword} options={{ headerTitle: 'Change Password' }} />
      {user?.role === 'admin' && (
        <MenuStack.Screen name="RequestsPage" component={LazyLeaveRequests} options={{ headerTitle: 'Leave Requests' }} />
      )}
      {user?.role === 'admin' && (
        <MenuStack.Screen name="EmployeesPage" component={LazyEmployees} options={{ headerTitle: 'Employees' }} />
      )}
      {user?.role === 'admin' && (
        <MenuStack.Screen name="EmployeeAttendancePage" component={LazyEmployeeAttendance} options={{ headerTitle: 'Employee Attendance' }} />
      )}
    </MenuStack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            'My Attendance': focused ? 'time' : 'time-outline',
            'QR Check-In': focused ? 'qr-code' : 'qr-code-outline',
            Leaves: focused ? 'document-text' : 'document-text-outline',
            Calendar: focused ? 'calendar' : 'calendar-outline',
            More: focused ? 'grid' : 'grid-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        headerStyle: { backgroundColor: '#0f172a' },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="My Attendance" component={LazyAttendance} options={{ headerTitle: 'My Attendance' }} />
      <Tab.Screen
        name="QR Check-In"
        component={LazyQrCheckIn}
        options={{
          headerTitle: 'QR Check-In',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTitleStyle: { color: '#ffffff', fontWeight: '700' },
        }}
      />
      <Tab.Screen name="Leaves" component={LazyLeaves} options={{ headerTitle: 'Leave Management' }} />
      <Tab.Screen name="Calendar" component={LazyCalendar} options={{ headerTitle: 'Monthly Calendar' }} />
      <Tab.Screen
        name="More"
        component={MenuStackScreen}
        options={{ headerShown: false }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('More', { screen: 'MenuHome' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        user.must_change_password ? (
          <Stack.Screen name="ChangePassword" component={LazyChangePassword} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ProfileModal"
              component={LazyProfile}
              options={{
                headerShown: true,
                headerTitle: 'My Profile',
                headerStyle: { backgroundColor: '#0f172a' },
                headerShadowVisible: false,
                headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
                headerBackTitleVisible: false,
                headerTintColor: '#94a3b8',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="ChangePasswordPage"
              component={LazyChangePassword}
              options={{
                headerShown: true,
                headerTitle: 'Change Password',
                headerStyle: { backgroundColor: '#0f172a' },
                headerShadowVisible: false,
                headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
                headerBackTitleVisible: false,
                headerTintColor: '#94a3b8',
                animation: 'slide_from_right',
              }}
            />
          </>
        )
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  menuContent: {
    padding: 20,
    paddingBottom: 40,
  },
  menuSection: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    marginLeft: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 68,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
});

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Handle notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification arrived in foreground — no navigation, just let the banner show
    });

    // Handle notification tapped (when app is in background/killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Navigate based on notification type
      setTimeout(() => {
        const nav = navigationRef.current;
        if (!nav) return;
        if (data?.type === 'notice') {
          nav.navigate('Main', { screen: 'More', params: { screen: 'NoticesPage' } });
        } else {
          nav.navigate('Main', { screen: 'More', params: { screen: 'NotificationsPage' } });
        }
      }, 500);
    });

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <UpdateChecker>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="light" />
            <AppNavigator />
          </NavigationContainer>
        </UpdateChecker>
      </AuthProvider>
    </ErrorBoundary>
  );
}
