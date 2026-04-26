import React from 'react';
import { 
  Trash2, 
  Plus, 
  CheckCircle, 
  Clock,
  AlertCircle
} from 'lucide-react';

/**
 * Section Header with optional action button.
 */
export const SectionHeader = ({ icon: Icon, title, subTitle, onAction, actionLabel, actionIcon: ActionIcon = Plus }) => (
  <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
      <div>
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">{title}</h3>
        {subTitle && <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{subTitle}</p>}
      </div>
    </div>
    {onAction && (
      <button 
        onClick={onAction}
        className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors uppercase"
      >
        <ActionIcon className="w-3 h-3" />
        {actionLabel}
      </button>
    )}
  </div>
);

/**
 * Standard Form Group with label.
 */
export const FormGroup = ({ label, children, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
    {children}
  </div>
);

/**
 * Row for Patient Identifiers (UHID, Aadhaar, etc.)
 */
export const IdentifierRow = ({ ident, masters, onChange, onRemove }) => (
  <div className="flex gap-3 animate-in fade-in slide-in-from-left-4">
    <select 
      className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50/30 text-sm"
      value={ident.identifier_id}
      onChange={(e) => onChange(ident.index, 'identifier_id', e.target.value)}
    >
      <option value="">Select Type</option>
      {masters.identifiers.map(i => <option key={i.id} value={i.id}>{i.id_name}</option>)}
    </select>
    <input 
      type="text" 
      placeholder="Value"
      className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
      value={ident.id_value || ''}
      onChange={(e) => onChange(ident.index, 'id_value', e.target.value)}
    />
    <button 
      onClick={() => onRemove(ident.index)} 
      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
    >
      <Trash2 className="w-5 h-5" />
    </button>
  </div>
);

/**
 * Row for Services (Consultation, Pharmacy, etc.)
 */
export const ServiceRow = ({ srv, index, masters, onChange, onRemove }) => (
  <div className="p-4 bg-slate-50/30 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-right-4">
    <div className="flex flex-col md:flex-row gap-4 items-end">
      <FormGroup label="Service Type" className="flex-1">
        <select 
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-semibold text-sm"
          value={srv.service_id}
          onChange={(e) => onChange(index, 'service_id', e.target.value)}
        >
          <option value="">Choose Service...</option>
          {masters.services.map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
        </select>
      </FormGroup>
      <FormGroup label="Amount" className="w-full md:w-32">
        <input 
          type="number"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold text-sm"
          placeholder="0.00"
          value={srv.amount || 0}
          onChange={(e) => onChange(index, 'amount', e.target.value)}
        />
      </FormGroup>
      <button 
        onClick={() => onRemove(index)}
        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  </div>
);

/**
 * Settlement Card for the right sidebar.
 */
export const SettlementCard = ({ 
  totalAmount, 
  payments, 
  isFree, 
  onAddPayment, 
  onRemovePayment, 
  onUpdatePayment, 
  onToggleFree,
  onNotesChange,
  notes,
  onSubmit,
  loading,
  masters
}) => {
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
  const balance = totalAmount - totalPaid;

  return (
    <div className="bg-slate-900 rounded-3xl shadow-xl p-8 text-white space-y-8 sticky top-8">
      <div className="flex items-center gap-3 border-b border-white/10 pb-6">
        <h3 className="font-black uppercase tracking-widest text-sm text-indigo-400">Settlement</h3>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total Bill</span>
          <span className="text-2xl font-black tracking-tight">₹{totalAmount.toLocaleString()}</span>
        </div>

        {balance > 0.01 && !isFree ? (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center text-amber-400">
              <span className="text-[10px] font-black uppercase tracking-widest">Balance Due</span>
              <span className="font-black">₹{balance.toLocaleString()}</span>
            </div>
          </div>
        ) : totalPaid > 0 && !isFree ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center text-emerald-400">
              <span className="text-[10px] font-black uppercase tracking-widest">Fully Settled</span>
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        ) : null}

        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Breakdown</label>
            <button onClick={onAddPayment} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase">+ Add</button>
          </div>
          
          {payments.map((pm, pIdx) => (
            <div key={pIdx} className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-2">
                <select 
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
                  value={pm.payment_mode_id}
                  onChange={(e) => onUpdatePayment(pIdx, 'payment_mode_id', e.target.value)}
                >
                  <option value="" className="text-slate-900">Mode</option>
                  {masters.payment_modes.map(m => <option key={m.id} value={m.id} className="text-slate-900">{m.mode}</option>)}
                </select>
                <input 
                  type="number"
                  className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-right"
                  placeholder="0.00"
                  value={pm.value || 0}
                  onChange={(e) => onUpdatePayment(pIdx, 'value', e.target.value)}
                />
                {payments.length > 1 && (
                  <button onClick={() => onRemovePayment(pIdx)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
          <input 
            type="checkbox" 
            id="free_flag_comp" 
            className="w-4 h-4 rounded border-white/20 text-indigo-500 bg-transparent focus:ring-offset-slate-900"
            checked={isFree}
            onChange={(e) => onToggleFree(e.target.checked)}
          />
          <label htmlFor="free_flag_comp" className="text-xs font-black text-slate-300 uppercase tracking-wider cursor-pointer select-none">Free</label>
        </div>

        <div className="space-y-2 pt-4 border-t border-white/5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Internal Notes</label>
          <textarea 
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium resize-none h-20"
            placeholder="Additional remarks..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>

        <button 
          onClick={onSubmit}
          disabled={loading || (totalAmount === 0 && !isFree)}
          className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
        >
          {loading ? <Clock className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
          {loading ? 'Processing...' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  );
};
