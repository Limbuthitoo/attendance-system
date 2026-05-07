import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [enabledModules, setEnabledModules] = useState(null); // null = loading, [] = none
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe()
        .then(data => {
          setUser(data.user);
          setEnabledModules(data.enabledModules || []);
          setPlan(data.plan || null);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, orgSlug) => {
    const data = await api.login(email, password, orgSlug);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    setEnabledModules(data.enabledModules || []);
    setPlan(data.plan || null);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setEnabledModules(null);
    setPlan(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, enabledModules, plan, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
