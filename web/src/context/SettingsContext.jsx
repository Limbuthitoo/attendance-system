import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

const SettingsContext = createContext({ dateFormat: 'AD' });

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ dateFormat: 'AD' });

  const loadSettings = useCallback(async () => {
    try {
      const data = await api._request('/settings');
      const s = data.settings || {};
      setSettings({
        dateFormat: s.date_format || 'AD',
      });
    } catch {
      // Keep defaults on error
    }
  }, []);

  useEffect(() => {
    if (user) loadSettings();
    else setSettings({ dateFormat: 'AD' });
  }, [user, loadSettings]);

  return (
    <SettingsContext.Provider value={{ ...settings, reloadSettings: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
