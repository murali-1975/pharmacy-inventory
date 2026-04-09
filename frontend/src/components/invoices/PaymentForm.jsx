import React, { useState } from 'react';
import { X, CreditCard, Calendar, IndianRupee, FileText, MessageSquare } from 'lucide-react';

const PaymentForm = ({ invoice, currentUser, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.paid_amount, 0);
  const balance = invoice.total_value - totalPaid;

  const [formData, setFormData] = useState({
    invoice_id: invoice.id,
    payment_mode: 'Bank Transfer',
    payment_date: new Date().toISOString().split('T')[0],
    paid_amount: balance > 0 ? balance : 0,
    payment_reference: '',
    remarks: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onSave(invoice.id, {
        ...formData,
        paid_amount: parseFloat(formData.paid_amount)
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-900">Record Payment</h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Invoice: {invoice.reference_number}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white rounded-xl transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Payment History Section */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="px-8 py-5 bg-gray-50 border-b border-gray-100 max-h-48 overflow-y-auto">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Payment History</h3>
            <div className="space-y-3">
              {invoice.payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div>
                    <div className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                       <CreditCard size={14} className="text-gray-400"/>
                       <span>{p.payment_mode}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                      {new Date(p.payment_date).toLocaleDateString()} 
                      {p.payment_reference && ` • Ref: ${p.payment_reference}`}
                      {p.remarks && ` • ${p.remarks}`}
                    </div>
                  </div>
                  <div className="text-sm font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                    + ₹{p.paid_amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.status === 'Paid' && currentUser?.role !== 'Admin' ? (
          <div className="p-8 text-center text-gray-500 text-sm font-medium">
            This invoice is completely settled. Only Administrators can record further payments.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center space-x-3 text-red-600 animate-shake">
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="payment-mode" className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Payment Mode</label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    id="payment-mode"
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="payment-date" className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Payment Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    id="payment-date"
                    type="date"
                    required
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="payment-amount" className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Paid Amount (₹) - Balance: ₹{balance.toLocaleString()}</label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-blue-50/30 border border-blue-100 text-blue-900 rounded-2xl pl-12 pr-4 py-4 font-black focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="payment-reference" className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Payment Reference</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="payment-reference"
                  type="text"
                  placeholder="Txn ID, Chq No, etc."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                  value={formData.payment_reference}
                  onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="payment-remarks" className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Remarks</label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-3 text-gray-400" size={18} />
                <textarea
                  id="payment-remarks"
                  rows="2"
                  placeholder="Optional notes..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-3 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-4 flex items-center space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-8 py-4 rounded-2xl font-black text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentForm;
