import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import UpdateChecker from './src/components/UpdateChecker';
import LoginScreen from './src/screens/LoginScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import LeavesScreen from './src/screens/LeavesScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import LeaveRequestsScreen from './src/screens/LeaveRequestsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DesignTasksScreen from './src/screens/DesignTasksScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NoticesScreen from './src/screens/NoticesScreen';
import { api } from './src/api';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();

const navigationRef = React.createRef();

function MenuItem({ icon, label, description, onPress, color = '#2563eb' }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.menuIcon, { backgroundColor: color + '12' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        {description && <Text style={styles.menuDesc}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
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
          icon="document-text-outline"
          label="Leaves"
          description="Apply & track leave requests"
          onPress={() => navigation.navigate('LeavesPage')}
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="megaphone-outline"
          label="Notices"
          description="Official notices & announcements"
          onPress={() => navigation.navigate('NoticesPage')}
          color="#2563eb"
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="color-palette-outline"
          label="My Design Tasks"
          description="Event designs assigned to you"
          onPress={() => navigation.navigate('DesignTasksPage')}
          color="#8b5cf6"
        />
        <View style={styles.menuDivider} />
        <MenuItem
          icon="person-outline"
          label="Profile"
          description="Account settings & info"
          onPress={() => navigation.navigate('ProfilePage')}
          color="#64748b"
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
          </View>
        </>
      )}
    </ScrollView>
  );
}

function MenuStackScreen() {
  const { user } = useAuth();
  return (
    <MenuStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
        headerBackTitleVisible: false,
        headerTintColor: '#2563eb',
      }}
    >
      <MenuStack.Screen name="MenuHome" component={MenuScreen} options={{ headerTitle: 'More' }} />
      <MenuStack.Screen name="LeavesPage" component={LeavesScreen} options={{ headerTitle: 'Leave Management' }} />
      <MenuStack.Screen name="NoticesPage" component={NoticesScreen} options={{ headerTitle: 'Notices' }} />
      <MenuStack.Screen name="DesignTasksPage" component={DesignTasksScreen} options={{ headerTitle: 'My Design Tasks' }} />
      <MenuStack.Screen name="ProfilePage" component={ProfileScreen} options={{ headerTitle: 'My Profile' }} />
      {user?.role === 'admin' && (
        <MenuStack.Screen name="RequestsPage" component={LeaveRequestsScreen} options={{ headerTitle: 'Leave Requests' }} />
      )}
      {user?.role === 'admin' && (
        <MenuStack.Screen name="EmployeesPage" component={EmployeesScreen} options={{ headerTitle: 'Employees' }} />
      )}
    </MenuStack.Navigator>
  );
}

function MainTabs() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const fetchUnread = useCallback(async () => {
    try {
      const data = await api.getUnreadCount();
      setUnreadCount(data.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnread();
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Attendance: focused ? 'time' : 'time-outline',
            Alerts: focused ? 'notifications' : 'notifications-outline',
            Calendar: focused ? 'calendar' : 'calendar-outline',
            More: focused ? 'grid' : 'grid-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerTitle: 'Attendance System' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ headerTitle: 'Attendance History' }} />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{
          headerTitle: 'Notifications',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 10, minWidth: 18, height: 18, lineHeight: 18 },
        }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ headerTitle: 'Monthly Calendar' }} />
      <Tab.Screen name="More" component={MenuStackScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        user.must_change_password ? (
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
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
    backgroundColor: '#f8fafc',
  },
  menuContent: {
    padding: 16,
    paddingBottom: 40,
  },
  menuSection: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    fontWeight: '600',
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
});

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Handle notification tapped (when app is in background/killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      // Navigate based on notification type
      setTimeout(() => {
        const nav = navigationRef.current;
        if (!nav) return;
        if (data?.type === 'notice') {
          nav.navigate('Main', { screen: 'More', params: { screen: 'NoticesPage' } });
        } else if (data?.type === 'design_task_reminder') {
          nav.navigate('Main', { screen: 'Calendar' });
        } else {
          nav.navigate('Main', { screen: 'Alerts' });
        }
      }, 500);
    });

    return () => {
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <AuthProvider>
      <UpdateChecker>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </UpdateChecker>
    </AuthProvider>
  );
}
