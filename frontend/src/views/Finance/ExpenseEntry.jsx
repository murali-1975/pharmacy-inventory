import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Wallet,
  Calendar,
  FileText,
  Hash,
  IndianRupee,
  Clock,
  ArrowLeft
} from 'lucide-react';
import api from '../../api';
import { SectionHeader, FormGroup } from './components/FinanceFormComponents';

/**
 * SplitPaymentRow - Internal component for managing a single payment mode line item.
 */
const SplitPaymentRow = ({ index, payment, modes, onUpdate, onRemove, showRemove }) => (
  <div className="flex flex-col md:flex-row gap-4 items-start bg-slate-50/50 p-4 rounded-3xl border border-slate-100 animate-in fade-in slide-in-from-right-4">
    <FormGroup label="Mode" className="w-full md:w-1/3">
      <select 
        required
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold text-sm"
        value={payment.payment_mode_id}
        onChange={(e) => onUpdate(index, 'payment_mode_id', e.target.value ? parseInt(e.target.value) : '')}
      >
        <option value="">Select Mode</option>
        {modes.map(m => <option key={m.id} value={m.id}>{m.mode}</option>)}
      </select>
    </FormGroup>
    <FormGroup label="Amount" className="w-full md:w-32">
      <input 
        type="number"
        required
        step="0.01"
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-black text-sm"
        value={payment.amount}
        onChange={(e) => onUpdate(index, 'amount', e.target.value)}
      />
    </FormGroup>
    <FormGroup label="Payment Notes" className="flex-1">
      <input 
        type="text"
        placeholder="Optional notes for this mode"
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium text-sm"
        value={payment.notes || ''}
        onChange={(e) => onUpdate(index, 'notes', e.target.value)}
      />
    </FormGroup>
    {showRemove && (
      <button 
        type="button"
        onClick={() => onRemove(index)}
        className="mt-6 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
      >
        <Trash2 size={18} />
      </button>
    )}
  </div>
);

/**
 * ExpenseEntry - Module for recording and updating operational expenses.
 * Supports multi-mode split payments and strict total reconciliation.
 * 
 * Props:
 * - token: Auth token
 * - initialData: Optional existing record for edit mode
 * - onSuccess: Callback after successful persist
 * - onUnauthorized: Callback for 401 errors
 */
const ExpenseEntry = ({ token, initialData, onSuccess, onUnauthorized, onToggleBulk, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState({ expense_types: [], payment_modes: [] });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form State Initialization
  const defaultForm = {
    expense_date: new Date().toISOString().split('T')[0],
    expense_type_id: '',
    details: '',
    reference_number: '',
    amount: 0,
    gst_amount: 0,
    total_amount: 0,
    notes: '',
    payments: [{ payment_mode_id: '', amount: 0, notes: '' }]
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    console.info("[ExpenseEntry] Component mounted. Initializing data...");
    fetchMasters();
  }, []);

  useEffect(() => {
    if (initialData) {
      console.info(`[ExpenseEntry] Entering Edit Mode for ID: ${initialData.id}`);
      setFormData({
        ...initialData,
        payments: initialData.payments?.length > 0 
          ? initialData.payments.map(p => ({ ...p }))
          : [{ payment_mode_id: '', amount: 0, notes: '' }],
        expense_date: initialData.expense_date || new Date().toISOString().split('T')[0]
      });
    }
  }, [initialData]);

  /**
   * Fetches dropdown masters for categories and payment modes.
   */
  const fetchMasters = async () => {
    try {
      const data = await api.getFinanceMasters(token);
      setMasters(data);
    } catch (err) {
      console.error("[ExpenseEntry] Master fetch failed:", err);
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError("System Error: Failed to load expense categories.");
    }
  };

  /**
   * Recalculates total when base or GST changes.
   */
  const calculateTotal = (base, gst) => {
    // Base Cost is now the Total Amount. GST is part of it for recording.
    const total = parseFloat(base || 0);
    setFormData(prev => ({ ...prev, amount: base, gst_amount: gst, total_amount: total }));
  };

  /**
   * Management for Split Payments
   */
  const addPaymentRow = () => {
    setFormData(prev => ({
      ...prev,
      payments: [...prev.payments, { payment_mode_id: '', amount: 0, notes: '' }]
    }));
  };

  const removePaymentRow = (index) => {
    setFormData(prev => ({
      ...prev,
      payments: prev.payments.filter((_, i) => i !== index)
    }));
  };

  const updatePayment = useCallback((index, field, value) => {
    setFormData(prev => {
      const newPayments = [...prev.payments];
      newPayments[index] = { ...newPayments[index], [field]: value };
      return { ...prev, payments: newPayments };
    });
  }, []);

  /**
   * Persistence Logic
   */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    console.info("[ExpenseEntry] Submission triggered...");
    
    setLoading(true);
    setError(null);

    // 1. Client-side Validation (Secured logic)
    if (!formData.expense_type_id) {
      setError("Please select an expense category.");
      setLoading(false);
      return;
    }

    const invalidPayment = formData.payments.find(p => !p.payment_mode_id || p.amount <= 0);
    if (invalidPayment) {
      setError("Please ensure all payment modes are selected and amounts are greater than zero.");
      setLoading(false);
      return;
    }

    const totalPaid = formData.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    if (Math.abs(totalPaid - formData.total_amount) > 0.01) {
      const msg = `Reconciliation Error: Payment sum (₹${totalPaid}) must exactly match total (₹${formData.total_amount})`;
      console.warn(`[ExpenseEntry] ${msg}`);
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      await api.saveExpense(token, formData, initialData?.id);
      console.info("[ExpenseEntry] Record persisted successfully.");
      setSuccess(true);
      
      // Cleanup for new entry
      if (!initialData) {
        setFormData(defaultForm);
      }
      
      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err) {
      console.error("[ExpenseEntry] Persistence failed:", err);
      setError(err.message || "Request Error: Unable to save expense record.");
    } finally {
      setLoading(false);
    }
  };

  const totalPaid = formData.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const balance = formData.total_amount - totalPaid;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200">
              <Wallet size={24} />
            </div>
            {initialData ? 'Update Expense' : 'Record Expense'}
          </h1>
          <p className="text-slate-500 font-medium ml-12">
            {initialData ? `Modifying legacy audit trail #${initialData.id}` : 'Audit and manage operational outflows'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!initialData && onToggleBulk && (
            <button 
              onClick={onToggleBulk}
              className="px-6 py-2.5 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-100"
            >
              <Plus size={14} />
              Bulk Upload
            </button>
          )}
          {initialData && (
             <button 
                onClick={onSuccess}
                className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
             >
                <ArrowLeft size={14} />
                Return to History
             </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Inputs Column */}
        <div className="lg:col-span-2 space-y-6">
          <form className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
            <SectionHeader 
              icon={FileText} 
              title="Audit Metadata" 
              subTitle="Primary transaction context" 
            />
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormGroup label="Transaction Date">
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
                  <input 
                    type="date" 
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700 transition-all"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                  />
                </div>
              </FormGroup>

              <FormGroup label="Expense Category">
                <select 
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700 appearance-none bg-white transition-all"
                  value={formData.expense_type_id}
                  onChange={(e) => setFormData({...formData, expense_type_id: e.target.value ? parseInt(e.target.value) : ''})}
                >
                  <option value="">Select Category...</option>
                  {masters.expense_types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </FormGroup>

              <FormGroup label="Expense Detail / Purpose" className="md:col-span-2">
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Utility Payment - April 2024"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700 transition-all"
                  value={formData.details}
                  onChange={(e) => setFormData({...formData, details: e.target.value})}
                />
              </FormGroup>

              <FormGroup label="Reference Number">
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Invoice # or Transaction ID"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700 transition-all"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                  />
                </div>
              </FormGroup>

              <div className="grid grid-cols-2 gap-4">
                <FormGroup label="Base Cost">
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="number" 
                      required
                      step="0.01"
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700"
                      value={formData.amount}
                      onChange={(e) => calculateTotal(e.target.value, formData.gst_amount)}
                    />
                  </div>
                </FormGroup>
                <FormGroup label="GST Component">
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-slate-700"
                      value={formData.gst_amount}
                      onChange={(e) => calculateTotal(formData.amount, e.target.value)}
                    />
                  </div>
                </FormGroup>
              </div>
            </div>

            <SectionHeader 
              icon={IndianRupee} 
              title="Payment Distribution" 
              subTitle="Split between multiple modes" 
              onAction={addPaymentRow}
              actionLabel="Add Mode"
            />

            <div className="p-8 space-y-4">
              {formData.payments.map((p, idx) => (
                <SplitPaymentRow 
                  key={idx}
                  index={idx}
                  payment={p}
                  modes={masters.payment_modes}
                  onUpdate={updatePayment}
                  onRemove={removePaymentRow}
                  showRemove={formData.payments.length > 1}
                />
              ))}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <FormGroup label="Additional Observations">
                <textarea 
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-medium text-sm h-24 resize-none transition-all"
                  placeholder="Notes for audit purpose..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </FormGroup>
            </div>
          </form>
        </div>

        {/* Financial Summary Overlay */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 text-white space-y-8 sticky top-8">
            <div className="flex items-center gap-3 border-b border-white/10 pb-6">
              <h3 className="font-black uppercase tracking-widest text-sm text-amber-400 text-center w-full">Statement Summary</h3>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-3xl border border-white/10">
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Total Amount</span>
                <span className="text-4xl font-black tracking-tighter">₹{formData.total_amount.toLocaleString()}</span>
              </div>

              {/* Status Indicators */}
              <div className="space-y-3">
                {balance > 0.01 ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center text-amber-400">
                      <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Allocation</span>
                      <span className="font-black">₹{balance.toLocaleString()}</span>
                    </div>
                  </div>
                ) : balance < -0.01 ? (
                  <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center text-red-400">
                      <span className="text-[10px] font-black uppercase tracking-widest">Excess Allocation</span>
                      <span className="font-black">₹{Math.abs(balance).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center text-emerald-400">
                      <span className="text-[10px] font-black uppercase tracking-widest">Full Reconciliation</span>
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle size={16} />
                    {initialData ? 'Audit Record Updated' : 'Record Finalized'}
                  </div>
                )}
              </div>

              <button 
                onClick={handleSubmit}
                disabled={loading || formData.total_amount <= 0 || Math.abs(balance) > 0.01}
                className="w-full py-5 bg-amber-500 text-white rounded-3xl font-black shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? <Clock className="w-5 h-5 animate-spin" /> : <CheckCircle size={24} />}
                {loading ? 'Processing...' : (initialData ? 'Commit Updates' : 'Finalize Record')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseEntry;
