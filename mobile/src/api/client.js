import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.3:3001/api';

export async function getToken() {
  return await SecureStore.getItemAsync('token');
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    throw new Error('Session expired');
  }

  const data = await res.json();
  await SecureStore.setItemAsync('token', data.token);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  return data.token;
}

export async function request(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !options._isRetry) {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }

      try {
        const newToken = await (refreshPromise || refreshAccessToken());
        return request(endpoint, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
          _isRetry: true,
        });
      } catch {
        // Refresh failed
      }
    }
  }

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    if (data.organizations) err.organizations = data.organizations;
    err.status = res.status;
    throw err;
  }

  return data;
}
