import { useState, useCallback } from 'react';
import api from '../api';

export const useLookups = (token, onUnauthorized) => {
  const [types, setTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);

  const fetchLookups = useCallback(async (includeInactive = false) => {
    if (!token) return;
    try {
      const [tData, sData] = await Promise.all([
        api.getSupplierTypes(token, includeInactive),
        api.getStatuses(token, includeInactive)
      ]);
      setTypes(tData);
      setStatuses(sData);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch lookups', err);
    }
  }, [token, onUnauthorized]);

  const handleSaveType = useCallback(async (typeData, id) => {
    try {
      await api.saveSupplierType(token, typeData, id);
      await fetchLookups();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save supplier type');
    }
  }, [token, fetchLookups, onUnauthorized]);

  const handleDeleteType = useCallback(async (id) => {
    if (!window.confirm("Are you sure you want to delete/deactivate this supplier type?")) return;
    try {
      await api.deleteSupplierType(token, id);
      await fetchLookups();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete supplier type');
    }
  }, [token, fetchLookups, onUnauthorized]);

  const handleSaveStatus = useCallback(async (statusData, id) => {
    try {
      await api.saveStatus(token, statusData, id);
      await fetchLookups();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save status');
    }
  }, [token, fetchLookups, onUnauthorized]);

  const handleDeleteStatus = useCallback(async (id) => {
    if (!window.confirm("Are you sure you want to delete/deactivate this status?")) return;
    try {
      await api.deleteStatus(token, id);
      await fetchLookups();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete status');
    }
  }, [token, fetchLookups, onUnauthorized]);

  return {
    types,
    statuses,
    fetchLookups,
    handleSaveType,
    handleDeleteType,
    handleSaveStatus,
    handleDeleteStatus
  };
};
