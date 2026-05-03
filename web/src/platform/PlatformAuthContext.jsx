import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, getToken } from './api';

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('platform_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify stored token on mount
    if (getToken()) {
      getMe()
        .then((data) => {
          setUser(data.user);
          localStorage.setItem('platform_user', JSON.stringify(data.user));
        })
        .catch(() => {
          setUser(null);
          localStorage.removeItem('platform_user');
          localStorage.removeItem('platform_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const data = await apiLogin(email, password);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <PlatformAuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  return ctx;
}
