import { useState, useCallback } from 'react';
import api from '../api';

export const useInvoices = (token, onUnauthorized) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const pageSize = 10;

  const fetchInvoices = useCallback(async (page = currentPage) => {
    if (!token) return;
    setLoading(true);
    try {
      const skip = (page - 1) * pageSize;
      const data = await api.getInvoices(token, skip, pageSize);
      setInvoices(data.items || []);
      setTotalInvoices(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized, currentPage, pageSize]);
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

  const saveInvoicePayment = useCallback(async (invoiceId, paymentData) => {
    try {
      await api.addInvoicePayment(invoiceId, paymentData, token);
      await fetchInvoices();
      return true;
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      throw err; // Let the form handle the specific error message
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

  const changePage = (newPage) => {
    fetchInvoices(newPage);
  };

  return {
    invoices,
    loading,
    fetchInvoices,
    saveInvoice,
    deleteInvoice,
    currentPage,
    totalInvoices,
    pageSize,
    changePage,
    saveInvoicePayment
  };
};
