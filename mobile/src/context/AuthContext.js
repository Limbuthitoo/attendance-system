import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api';
import { registerForPushNotifications, unregisterPushToken } from '../notifications';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        const data = await api.getMe();
        setUser(data.user);
        // Register push token on app start (if logged in)
        registerForPushNotifications().catch(() => {});
      }
    } catch {
      await SecureStore.deleteItemAsync('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, orgSlug) => {
    const data = await api.login(email, password, orgSlug);
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    setUser(data.user);
    // Register push token after login
    registerForPushNotifications().catch(() => {});
    return data.user;
  };

  const logout = async () => {
    // Unregister push token before logout
    await unregisterPushToken().catch(() => {});
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
