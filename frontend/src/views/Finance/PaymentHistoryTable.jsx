import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Edit2, 
  Trash2,
  Plus,
  AlertCircle,
  Calendar,
  RefreshCcw
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import api from '../../api';

const PaymentHistoryTable = ({ token, currentUser, onEdit, onView, onAdd, onUnauthorized }) => {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  // Advanced Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [singleDate, setSingleDate] = useState('');
  
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      // Note: We prioritize from/to over single date if both are provided
      const data = await api.getPatientPayments(token, skip, limit, searchTerm, singleDate, fromDate, toDate);
      setPayments(data.items);
      setTotal(data.total);
    } catch (error) {
      if (error.message === 'Unauthorized') onUnauthorized();
      else console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, searchTerm, singleDate, fromDate, toDate, onUnauthorized]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPayments();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchPayments]);

  const handleDelete = async (id) => {
    setDeleteError(null);
    try {
      await api.deletePatientPayment(token, id);
      setDeletingId(null);
      fetchPayments(); // Refresh list
    } catch (error) {
      setDeleteError('Failed to delete payment record. Please try again.');
      console.error('Delete error:', error);
    }
  };

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setSingleDate(today);
    setFromDate('');
    setToDate('');
  };

  const clearDateFilters = () => {
    setSingleDate('');
    setFromDate('');
    setToDate('');
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Search & Basic Filter Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-1 items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name..."
            className="bg-transparent border-none outline-none w-full text-slate-700 font-medium placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Actions */}
          <button 
            onClick={setTodayFilter}
            className="flex items-center gap-2 text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            Today
          </button>
          
          <button 
            onClick={clearDateFilters}
            className="flex items-center gap-2 text-xs font-black text-slate-500 bg-slate-50 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
            title="Clear Filters"
          >
            <RefreshCcw className="w-3 h-3" />
          </button>

          <button 
            onClick={onAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-200 text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Advanced Date Filter Section */}
      <div className="grid md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specific Date</label>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Activity className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              className="bg-transparent border-none outline-none text-xs text-slate-600 w-full font-bold"
              value={singleDate}
              onChange={(e) => { setSingleDate(e.target.value); setFromDate(''); setToDate(''); }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              className="bg-transparent border-none outline-none text-xs text-slate-600 w-full font-bold"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setSingleDate(''); }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              className="bg-transparent border-none outline-none text-xs text-slate-600 w-full font-bold"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setSingleDate(''); }}
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Patient Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Identifiers</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Settlement</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array(limit).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="6" className="px-6 py-6">
                      <div className="h-8 bg-slate-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                      <Search className="w-12 h-12 text-slate-300" />
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records matching your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-6 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-700">{formatDate(payment.payment_date)}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{new Date(payment.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="font-black text-slate-900 tracking-tight">{payment.patient_name}</div>
                      {payment.token_no && (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-black uppercase mt-1">
                          <Activity className="w-3 h-3" />
                          Token: {payment.token_no}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-wrap gap-1.5">
                        {payment.identifiers?.map((id, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-tighter">
                            {id.id_value}
                          </span>
                        ))}
                        {(!payment.identifiers || payment.identifiers.length === 0) && (
                          <span className="text-[10px] text-slate-300 italic">No IDs</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      {(() => {
                        const status = payment.payment_status || 'PAID';
                        const colors = {
                          'PAID': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                          'PARTIAL': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                          'DUE': 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        };
                        return (
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${colors[status]}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-right">
                      <div className="font-black text-slate-900 text-base">₹{payment.total_amount.toLocaleString()}</div>
                      {(() => {
                        const totalPaid = payment.payments?.reduce((sum, p) => sum + p.value, 0) || 0;
                        const balance = payment.total_amount - totalPaid;
                        if (balance > 0.01 && !payment.free_flag) {
                          return <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mt-0.5">Due: ₹{balance.toLocaleString()}</div>;
                        } else if (payment.free_flag) {
                          return <div className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mt-0.5">Free Visit</div>;
                        }
                        return <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Settled</div>;
                      })()}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-2">
                        <button 
                          onClick={() => onView?.(payment)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => onEdit?.(payment)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        {currentUser?.role === 'Admin' && (
                          <button 
                            onClick={() => setDeletingId(payment.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Delete Record"
                            data-testid={`delete-payment-${payment.id}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Delete Confirmation Overlay */}
        {deletingId && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex items-center justify-center animate-in fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full mx-4 text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto rotate-12">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Confirm Deletion</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium">
                  This transaction will be permanently removed. All financial summaries will be recalculated.
                </p>
                {deleteError && (
                  <p className="text-xs text-rose-600 mt-3 font-black bg-rose-50 p-2 rounded-lg">{deleteError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setDeletingId(null); setDeleteError(null); }}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deletingId)}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl text-sm font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Showing <span className="text-slate-900">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="text-slate-900">{Math.min(page * limit, total)}</span> of <span className="text-slate-900">{total}</span> records
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-black text-slate-700 shadow-sm">
              Page {page} <span className="text-slate-300 font-medium mx-1">of</span> {totalPages || 1}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              aria-label="Next"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryTable;
