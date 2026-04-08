import { useState, useCallback } from 'react';
import api from '../api';

/**
 * Hook for managing medicine data and operations.
 * 
 * @param {string} token - The authentication token.
 * @param {function} onUnauthorized - Callback function for handling 401 Unauthorized errors.
 * @returns {Object} Medicine state, loading status, and handler functions.
 */
export const useMedicines = (token, onUnauthorized) => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Fetches the list of medicines from the backend.
   */
  const fetchMedicines = useCallback(async (retries = 2, delay = 1000) => {
    if (!token) return;
    setLoading(true);
    let success = false;
    try {
      const data = await api.getMedicines(token);
      setMedicines(data);
      success = true;
    } catch (err) {
      if (err.message === 'Unauthorized') {
        onUnauthorized();
      } else if (retries > 0) {
        console.warn(`Fetch medicines failed, retrying in ${delay}ms...`, err);
        setTimeout(() => fetchMedicines(retries - 1, delay * 2), delay);
      } else {
        console.error('Failed to fetch medicines after retries', err);
      }
    } finally {
      if (success || retries === 0) {
        setLoading(false);
      }
    }
  }, [token, onUnauthorized]);

  /**
   * Creates a new medicine or updates an existing one.
   * 
   * @param {Object} medicineData - The medicine data to save.
   * @param {number|null} id - The ID of the medicine to update, or null for a new medicine.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  const saveMedicine = useCallback(async (medicineData, id) => {
    try {
      await api.saveMedicine(token, medicineData, id);
      await fetchMedicines();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save medicine');
      return false;
    }
  }, [token, fetchMedicines, onUnauthorized]);

  /**
   * Deletes a medicine by ID.
   * 
   * @param {number} id - The ID of the medicine to delete.
   */
  const deleteMedicine = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    try {
      await api.deleteMedicine(token, id);
      await fetchMedicines();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete medicine');
    }
  }, [token, fetchMedicines, onUnauthorized]);

  return {
    medicines,
    loading,
    fetchMedicines,
    saveMedicine,
    deleteMedicine
  };
};
