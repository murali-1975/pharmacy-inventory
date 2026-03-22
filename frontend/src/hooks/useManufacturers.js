import { useState, useCallback } from 'react';
import api from '../api';

export const useManufacturers = (token, onUnauthorized) => {
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchManufacturers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getManufacturers(token);
      setManufacturers(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch manufacturers', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  const saveManufacturer = useCallback(async (manufacturerData, id) => {
    try {
      await api.saveManufacturer(token, manufacturerData, id);
      await fetchManufacturers();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save manufacturer');
      return false;
    }
  }, [token, fetchManufacturers, onUnauthorized]);

  const deleteManufacturer = useCallback(async (id) => {
    try {
      await api.deleteManufacturer(token, id);
      await fetchManufacturers();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete manufacturer');
      return false;
    }
  }, [token, fetchManufacturers, onUnauthorized]);

  return {
    manufacturers,
    loading,
    fetchManufacturers,
    saveManufacturer,
    deleteManufacturer
  };
};
