import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical, 
  Eye, 
  Edit2, 
  Trash2,
  Filter,
  Download,
  Plus
} from 'lucide-react';
import api from '../../api';

const PaymentHistoryTable = ({ token, onEdit, onView, onAdd, onUnauthorized }) => {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [dateFilter, setDateFilter] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      const data = await api.getPatientPayments(token, skip, limit, searchTerm, dateFilter);
      setPayments(data.items);
      setTotal(data.total);
    } catch (error) {
      if (error.message === 'Unauthorized') onUnauthorized();
      else console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, searchTerm, dateFilter]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPayments();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchPayments]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-1 items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients..."
            className="bg-transparent border-none outline-none w-full text-slate-700 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <Activity className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              className="bg-transparent border-none outline-none text-sm text-slate-600"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          
          <button 
            onClick={onAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identifiers</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-6 py-4">
                      <div className="h-6 bg-slate-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{payment.patient_name}</div>
                      {payment.token_no && (
                        <div className="text-xs text-slate-400">Token: {payment.token_no}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {payment.identifiers?.map((id, idx) => (
                          <span key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded border border-indigo-100">
                            {id.id_value}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-slate-700">
                      ₹{payment.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onView?.(payment)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEdit?.(payment)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              aria-label="Next"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryTable;
