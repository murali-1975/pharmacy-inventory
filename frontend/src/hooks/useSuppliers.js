import { useState, useCallback } from 'react';
import api from '../api';

/**
 * Hook for managing supplier data and operations.
 * 
 * @param {string} token - The authentication token.
 * @param {function} onUnauthorized - Callback function for handling 401 Unauthorized errors.
 * @returns {Object} Supplier state, loading status, and handler functions.
 */
export const useSuppliers = (token, onUnauthorized) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Fetches the list of suppliers from the backend.
   */
  const fetchSuppliers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getSuppliers(token);
      setSuppliers(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch suppliers', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  /**
   * Creates a new supplier or updates an existing one.
   * 
   * @param {Object} supplierData - The supplier data to save.
   * @param {number|null} id - The ID of the supplier to update, or null for a new supplier.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  const saveSupplier = useCallback(async (supplierData, id) => {
    try {
      await api.saveSupplier(token, supplierData, id);
      await fetchSuppliers();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save supplier');
      return false;
    }
  }, [token, fetchSuppliers, onUnauthorized]);

  /**
   * Deletes a supplier by ID after confirmation.
   * 
   * @param {number} id - The ID of the supplier to delete.
   */
  const deleteSupplier = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.deleteSupplier(token, id);
      await fetchSuppliers();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete supplier');
    }
  }, [token, fetchSuppliers, onUnauthorized]);

  return {
    suppliers,
    loading,
    fetchSuppliers,
    saveSupplier,
    deleteSupplier
  };
};
