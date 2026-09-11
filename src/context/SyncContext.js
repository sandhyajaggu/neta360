import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncNow } from '../sync/syncEngine';
import { getMeta, getOutboxSummary } from '../db/repo';
import { AUTO_SYNC_INTERVAL_MS } from '../config';
import { useAuth } from './AuthContext';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const { session, expire } = useAuth();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  // Screens reload their data whenever this number changes.
  const [dataVersion, setDataVersion] = useState(0);

  const running = useRef(false);
  const onlineRef = useRef(true);
  const debounce = useRef(null);

  const refreshStatus = useCallback(async () => {
    const s = await getOutboxSummary();
    setPending(s.pending);
    setFailed(s.failed);
    setLastSyncAt(await getMeta('last_sync_at'));
  }, []);

  const runSync = useCallback(async () => {
    if (!session || running.current) return;
    if (!onlineRef.current) {
      setError('No internet. Your work is saved on the phone and will be sent later.');
      return;
    }
    running.current = true;
    setSyncing(true);
    setError(null);
    try {
      await syncNow();
      setDataVersion((v) => v + 1);
    } catch (e) {
      if (e.status === 401) {
        await expire();
      } else {
        setError(e.message || 'Sync failed. It will retry automatically.');
      }
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshStatus();
    }
  }, [session, expire, refreshStatus]);

  // Call after any change on the phone: updates counts and syncs shortly after.
  const notifyLocalChange = useCallback(() => {
    setDataVersion((v) => v + 1);
    refreshStatus();
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSync(), 3000);
  }, [refreshStatus, runSync]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
      const cameBack = isOnline && !onlineRef.current;
      onlineRef.current = isOnline;
      setOnline(isOnline);
      if (cameBack) runSync();
    });
    return unsub;
  }, [runSync]);

  useEffect(() => {
    if (!session) return undefined;
    refreshStatus();
    runSync();
    const timer = setInterval(runSync, AUTO_SYNC_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') runSync();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ online, syncing, pending, failed, lastSyncAt, error, dataVersion, runSync, notifyLocalChange, refreshStatus }),
    [online, syncing, pending, failed, lastSyncAt, error, dataVersion, runSync, notifyLocalChange, refreshStatus]
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export const useSync = () => useContext(SyncContext);
