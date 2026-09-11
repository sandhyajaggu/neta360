import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSync } from '../context/SyncContext';

// Loads data from the phone database, and reloads it when the screen is
// opened again or when a sync / local change happens.
export function useLiveData(loader, deps = []) {
  const { dataVersion } = useSync();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    reload();
  }, [dataVersion, reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, reload };
}
