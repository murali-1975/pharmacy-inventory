import React from 'react';
import { 
  X, 
  User, 
  Calendar, 
  Hash, 
  CreditCard, 
  FileText, 
  Activity,
  CheckCircle,
  Tag
} from 'lucide-react';

const PaymentDetailsModal = ({ payment, masters, onClose }) => {
  if (!payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Payment Details</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction #{payment.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
          {/* Patient Info */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <User className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Patient Name</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{payment.patient_name}</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Payment Date</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{new Date(payment.payment_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Hash className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Token Number</span>
              </div>
              <p className="text-lg font-bold text-slate-800">{payment.token_no || 'N/A'}</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Tag className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Identifiers</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {payment.identifiers?.map((id, idx) => (
                  <span key={idx} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-lg border border-indigo-100">
                    {id.id_value}
                  </span>
                ))}
                {(!payment.identifiers || payment.identifiers.length === 0) && <span className="text-slate-400 text-sm font-medium">None</span>}
              </div>
            </div>
          </div>

          {/* Services & Payments */}
          <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
            {/* Services */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Services Rendered</span>
              </div>
              <div className="space-y-3">
                {payment.services?.map((srv, idx) => {
                  const sName = masters.services?.find(s => s.id === srv.service_id)?.service_name || 'Unknown Service';
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-700">{sName}</span>
                      <span className="text-sm font-black text-slate-900">₹{srv.amount?.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payments */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-400">
                <CreditCard className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Payment Breakdown</span>
              </div>
              <div className="space-y-3">
                {payment.payments?.map((pm, idx) => {
                  const mName = masters.payment_modes?.find(m => m.id === pm.payment_mode_id)?.mode || 'Unknown Mode';
                  return (
                    <div key={idx} className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <span className="text-sm font-bold text-emerald-700">{mName}</span>
                      <span className="text-sm font-black text-emerald-900">₹{pm.value?.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Notes</div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{payment.notes}</p>
            </div>
          )}

          {/* Final Total */}
          <div className="bg-slate-900 rounded-2xl p-6 flex justify-between items-center shadow-xl shadow-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Total Transaction Amount</span>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold">Payment Verified</span>
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">₹{payment.total_amount?.toLocaleString()}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;
