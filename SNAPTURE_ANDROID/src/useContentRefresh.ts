import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';

// Fetch again after returning from an attachment viewer or reopening the app.
export default function useContentRefresh() {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return { revision, refresh };
}
