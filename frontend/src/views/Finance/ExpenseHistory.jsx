import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  AlertCircle,
  Clock,
  Wallet,
  ArrowRightLeft,
  History
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import api from '../../api';
import { FormGroup } from './components/FinanceFormComponents';

/**
 * ExpenseRow - Internal component representing a single row in the history table.
 */
const ExpenseRow = ({ expense, onEdit, onDelete, isAdmin }) => {
  const { 
    id, 
    expense_date, 
    expense_type, 
    details, 
    reference_number, 
    total_amount, 
    modified_by,
    payments 
  } = expense;

  return (
    <tr className="hover:bg-slate-50/50 transition-all group">
      <td className="px-8 py-6">
        <div className="space-y-1.5">
          <p className="font-black text-slate-900 text-sm tracking-tight">
            {formatDate(expense_date)}
          </p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider">
            {expense_type?.name}
          </span>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="space-y-1 max-w-sm">
          <p className="font-bold text-slate-700 text-sm truncate">{details}</p>
          <div className="flex items-center gap-2">
             <span className="text-[10px] text-slate-400 font-medium">Audit ID #{id}</span>
             <span className="w-1 h-1 bg-slate-200 rounded-full" />
             <span className="text-[10px] text-slate-400 font-medium italic">User Key: {modified_by}</span>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="font-mono text-xs text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-lg w-fit">
          {reference_number || '---'}
        </p>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="space-y-1.5">
          <p className="text-lg font-black text-slate-900">₹{parseFloat(total_amount).toLocaleString()}</p>
          <div className="flex justify-end gap-1 flex-wrap">
            {payments.map((p, pidx) => (
              <span key={pidx} className="text-[8px] font-black bg-white border border-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                {p.payment_mode?.mode}
              </span>
            ))}
          </div>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={() => onEdit(expense)}
            className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all"
            title="Edit Transaction"
          >
            <Edit2 size={18} />
          </button>
          {isAdmin && (
            <button 
              onClick={() => onDelete(id)}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              title="Void Transaction"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

/**
 * ExpenseHistory - Audit view for tracking and managing past operational expenses.
 * 
 * Props:
 * - token: Auth token
 * - onEdit: Callback to trigger edit mode in parent
 * - onUnauthorized: Callback for 401 errors
 * - currentUser: Logged in user details (role check)
 */
const ExpenseHistory = ({ token, onEdit, onUnauthorized, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState({ items: [], total: 0 });
  const [masters, setMasters] = useState({ expense_types: [] });
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  const [filters, setFilters] = useState({
    type_id: '',
    from_date: '',
    to_date: '',
    searchTerm: ''
  });

  useEffect(() => {
    console.info("[ExpenseHistory] Component mounted. Loading master audit data...");
    fetchMasters();
  }, []);

  useEffect(() => {
    console.debug(`[ExpenseHistory] Filter/Page change detected. Page: ${page}, Filters:`, filters);
    fetchExpenses();
  }, [page, filters.type_id, filters.from_date, filters.to_date]);

  /**
   * Fetches required master categories for filtering.
   */
  const fetchMasters = async () => {
    try {
      const data = await api.getFinanceMasters(token);
      setMasters(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
    }
  };

  /**
   * Primary data fetch logic with pagination and multi-filter support.
   */
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await api.getExpenses(
        token, 
        page * pageSize, 
        pageSize, 
        filters.type_id, 
        filters.from_date, 
        filters.to_date
      );
      setExpenses(data);
    } catch (err) {
      console.error("[ExpenseHistory] Data fetch failed:", err);
      if (err.message === 'Unauthorized') onUnauthorized();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Voiding/Soft-deletion logic with secure admin-only check.
   */
  const handleDelete = async (id) => {
    if (!window.confirm("CAUTION: Are you sure you want to VOID this expense record? This action will be audited.")) return;
    
    try {
      console.warn(`[ExpenseHistory] Admin voiding record ID: ${id}`);
      await api.deleteExpense(token, id);
      fetchExpenses();
    } catch (err) {
      console.error("[ExpenseHistory] Void operation failed:", err);
      alert(`System Error: ${err.message}`);
    }
  };

  // Client-side search filtering (Sub-filter for loaded page)
  const filteredItems = useMemo(() => {
    return expenses.items.filter(item => 
      item.details.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      item.reference_number?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      idToString(item.id).includes(filters.searchTerm)
    );
  }, [expenses.items, filters.searchTerm]);

  function idToString(id) { return id?.toString() || ''; }

  const handleQuickToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setFilters(prev => ({ ...prev, from_date: today, to_date: today }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* View Branding */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200">
              <History size={24} />
            </div>
            Expense History
          </h2>
          <p className="text-slate-500 font-medium ml-12">Audit and manage past operational outflows</p>
        </div>
      </div>

      {/* Structured Filter Interface */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Quick search by details, reference or audit ID..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleQuickToday}
              className="px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-100 transition-all"
            >
              Today Only
            </button>
            <button 
              onClick={fetchExpenses}
              className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all"
              title="Refresh Data"
            >
              <ArrowRightLeft size={18} className="rotate-90" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
          <FormGroup label="Expense Category Filter">
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/20"
              value={filters.type_id}
              onChange={(e) => setFilters({...filters, type_id: e.target.value})}
            >
              <option value="">All Active Categories</option>
              {masters.expense_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </FormGroup>

          <FormGroup label="Audit Start Date">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none"
                value={filters.from_date}
                onChange={(e) => setFilters({...filters, from_date: e.target.value})}
              />
            </div>
          </FormGroup>

          <FormGroup label="Audit End Date">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none"
                value={filters.to_date}
                onChange={(e) => setFilters({...filters, to_date: e.target.value})}
              />
            </div>
          </FormGroup>
        </div>
      </div>

      {/* Main Data Presentation */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period / Class</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statement Detail</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Value</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-32 text-center">
                    <Clock className="w-12 h-12 text-slate-200 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest italic">Synchronizing Audit Records...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-32 text-center">
                    <div className="p-4 bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No matching audit records found</p>
                  </td>
                </tr>
              ) : filteredItems.map((exp) => (
                <ExpenseRow 
                  key={exp.id} 
                  expense={exp} 
                  onEdit={onEdit} 
                  onDelete={handleDelete}
                  isAdmin={currentUser?.role === 'Admin'}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Audit Pagination Controls */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
           <div>Showing {filteredItems.length} of {expenses.total} audit entries</div>
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="hover:text-amber-500 disabled:opacity-20 transition-colors"
              >
                Previous
              </button>
              <span className="text-slate-900 px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-100">Audit Page {page + 1}</span>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= expenses.total}
                className="hover:text-amber-500 disabled:opacity-20 transition-colors"
              >
                Next
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseHistory;
