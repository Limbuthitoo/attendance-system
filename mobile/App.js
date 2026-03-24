import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import LeavesScreen from './src/screens/LeavesScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Attendance: focused ? 'time' : 'time-outline',
            Leaves: focused ? 'calendar' : 'calendar-outline',
            Employees: focused ? 'people' : 'people-outline',
            Profile: focused ? 'person' : 'person-outline',
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerTitle: 'Archisys Attendance' }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ headerTitle: 'Attendance History' }} />
      <Tab.Screen name="Leaves" component={LeavesScreen} options={{ headerTitle: 'Leave Management' }} />
      {user?.role === 'admin' && (
        <Tab.Screen name="Employees" component={EmployeesScreen} options={{ headerTitle: 'Employees' }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerTitle: 'My Profile' }} />
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
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
