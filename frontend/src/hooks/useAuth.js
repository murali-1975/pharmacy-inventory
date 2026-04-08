import { useState, useCallback } from 'react';
import api from '../api';

export const useAuth = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [logoutReason, setLogoutReason] = useState(null);

  const login = useCallback(async (username, password) => {
    try {
      setAuthError('');
      setLogoutReason(null);
      const data = await api.login(username, password);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      return true;
    } catch (err) {
      setAuthError(err.message || 'Invalid username or password');
      return false;
    }
  }, []);

  const logout = useCallback((reason = null) => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    if (reason) setLogoutReason(reason);
  }, []);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const user = await api.getMe(token);
      setCurrentUser(user);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        logout('session_expired');
      }
    }
  }, [token, logout]);

  return {
    token,
    currentUser,
    authError,
    logoutReason,
    login,
    logout,
    fetchMe,
    setAuthError,
    setLogoutReason
  };
};
