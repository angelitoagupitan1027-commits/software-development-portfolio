import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState('PHP');

  const refresh = useCallback(async () => {
    if (!user) {
      setModel(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/analytics');
      setModel(data);
      setDisplayCurrency(data?.meta?.baseCurrency || 'PHP');
    } catch (e) {
      setError(e.message || 'Unable to load business data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fx = model?.meta?.fxRate || 58.5;

  return (
    <DataContext.Provider value={{ model, loading, error, refresh, fx, displayCurrency, setDisplayCurrency }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
