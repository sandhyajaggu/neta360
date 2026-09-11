import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setToken } from '../api/client';
import { clearAllData, getMeta, getOutboxSummary, setMeta } from '../db/repo';

const SESSION_KEY = 'neta360_session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          setToken(s.token);
          setSession(s);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (phone, password) => {
    const res = await api.login(phone.trim(), password);
    const s = { token: res.access_token, operator: res.operator, booth: res.booth };

    const prevOperator = await getMeta('operator_id');
    const prevBooth = await getMeta('booth_no');
    const sameOperator = !prevOperator || prevOperator === String(s.operator.id);
    const sameBooth = !prevBooth || prevBooth === String(s.booth.booth_no);
    if (!sameOperator || !sameBooth) {
      const { pending } = await getOutboxSummary();
      if (pending > 0) {
        throw new Error(
          `This phone has ${pending} unsent changes from booth ${prevBooth}. Log in with that account and sync first.`
        );
      }
      await clearAllData(); // never mix two booths' data on one phone
    }
    await setMeta('operator_id', s.operator.id);
    await setMeta('booth_no', s.booth.booth_no);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
    setToken(s.token);
    setExpired(false);
    setSession(s);
  }, []);

  // Full logout: removes all booth data from the phone.
  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearAllData();
    setToken(null);
    setSession(null);
  }, []);

  // Token expired: keep the booth data and unsent changes, ask to log in again.
  const expire = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setToken(null);
    setExpired(true);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, expired, login, logout, expire }),
    [session, loading, expired, login, logout, expire]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
