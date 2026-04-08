import { useState, useCallback } from 'react';
import api from '../api';

export const useInvoices = (token, onUnauthorized) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const pageSize = 10;

  const fetchInvoices = useCallback(async (page = currentPage, search = searchTerm, sort = sortBy, order = sortOrder) => {
    if (!token) return;
    setLoading(true);
    try {
      const skip = (page - 1) * pageSize;
      const data = await api.getInvoices(token, skip, pageSize, search, sort, order);
      setInvoices(data.items || []);
      setTotalInvoices(data.total || 0);
      setCurrentPage(page);
      setSearchTerm(search);
      setSortBy(sort);
      setSortOrder(order);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  }, [token, pageSize]); // Removed currentPage and searchTerm to prevent infinite loops

  const saveInvoice = useCallback(async (invoiceData, id) => {
    try {
      await api.saveInvoice(token, invoiceData, id);
      await fetchInvoices();
      return true;
    } catch (err) {
      alert(err.message || 'Failed to save invoice');
      return false;
    }
  }, [token, fetchInvoices]);

  const saveInvoicePayment = useCallback(async (invoiceId, paymentData) => {
    try {
      await api.addInvoicePayment(invoiceId, paymentData, token);
      await fetchInvoices();
      return true;
    } catch (err) {
      throw err; // Let the form handle the specific error message
    }
  }, [token, fetchInvoices]);

  const deleteInvoice = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.deleteInvoice(token, id);
      await fetchInvoices();
    } catch (err) {
      alert(err.message || 'Failed to delete invoice');
    }
  }, [token, fetchInvoices]);

  const changePage = (newPage) => {
    fetchInvoices(newPage, searchTerm, sortBy, sortOrder);
  };

  const handleSearch = (newSearchTerm) => {
    fetchInvoices(1, newSearchTerm, sortBy, sortOrder);
  };

  const handleSort = (field) => {
    const newOrder = (sortBy === field && sortOrder === 'desc') ? 'asc' : 'desc';
    fetchInvoices(1, searchTerm, field, newOrder);
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
    saveInvoicePayment,
    handleSearch,
    searchTerm,
    sortBy,
    sortOrder,
    handleSort
  };
};
