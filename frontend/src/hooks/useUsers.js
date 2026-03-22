import { useState, useCallback } from 'react';
import api from '../api';

/**
 * Hook for managing user data and operations.
 * 
 * @param {string} token - The authentication token.
 * @param {function} onUnauthorized - Callback function for handling 401 Unauthorized errors.
 * @returns {Object} User state and handler functions.
 */
export const useUsers = (token, onUnauthorized) => {
  const [users, setUsers] = useState([]);

  /**
   * Fetches the full list of users from the backend.
   */
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getUsers(token);
      setUsers(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch users', err);
    }
  }, [token, onUnauthorized]);

  /**
   * Creates a new user or updates an existing one.
   * 
   * @param {Object} userData - The user data to save.
   * @param {number|null} id - The ID of the user to update, or null for a new user.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  const handleSaveUser = useCallback(async (userData, id) => {
    try {
      await api.saveUser(token, userData, id);
      await fetchUsers();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save user');
      return false;
    }
  }, [token, fetchUsers, onUnauthorized]);

  /**
   * Deletes a user by ID after confirmation.
   * 
   * @param {number} id - The ID of the user to delete.
   */
  const handleDeleteUser = useCallback(async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await api.deleteUser(token, id);
      await fetchUsers();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete user');
    }
  }, [token, fetchUsers, onUnauthorized]);

  return {
    users,
    fetchUsers,
    handleSaveUser,
    handleDeleteUser
  };
};
