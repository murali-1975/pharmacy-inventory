import { useState, useCallback } from 'react';
import api from '../api';

export const useInvoices = (token, onUnauthorized) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getInvoices(token);
      setInvoices(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  const saveInvoice = useCallback(async (invoiceData, id) => {
    try {
      await api.saveInvoice(token, invoiceData, id);
      await fetchInvoices();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to save invoice');
      return false;
    }
  }, [token, fetchInvoices, onUnauthorized]);

  const deleteInvoice = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.deleteInvoice(token, id);
      await fetchInvoices();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else alert(err.message || 'Failed to delete invoice');
    }
  }, [token, fetchInvoices, onUnauthorized]);

  return {
    invoices,
    loading,
    fetchInvoices,
    saveInvoice,
    deleteInvoice
  };
};
