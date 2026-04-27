import React from 'react';
import { 
  X, 
  Calendar, 
  Users, 
  TrendingUp, 
  CreditCard, 
  ArrowDownCircle, 
  Download,
  Activity,
  CheckCircle,
  FileText
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { generateDailySummaryPDF } from '../../utils/invoiceGenerator';

const DailyBreakdownModal = ({ summary, onClose }) => {
  if (!summary) return null;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const netIncome = summary.total_revenue - summary.total_expenses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Daily Financial Breakdown</h2>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{formatDate(summary.summary_date)}</p>
              </div>
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
        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Patients</span>
              </div>
              <p className="text-xl font-black text-slate-800">{summary.patient_count}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Revenue</span>
              </div>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(summary.total_revenue)}</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Expenses</span>
              </div>
              <p className="text-xl font-black text-rose-700">{formatCurrency(summary.total_expenses)}</p>
            </div>
            <div className="bg-indigo-600 p-4 rounded-2xl border border-indigo-700 shadow-lg shadow-indigo-100">
              <div className="flex items-center gap-2 text-indigo-200 mb-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Net Income</span>
              </div>
              <p className="text-xl font-black text-white">{formatCurrency(netIncome)}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Income Sections */}
            <div className="space-y-6">
              {/* Service Breakdown */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Income by Services
                </h3>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Service</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Object.entries(summary.service_breakdown).map(([name, val]) => (
                        <tr key={name} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-700">{name}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(val)}</td>
                        </tr>
                      ))}
                      {Object.keys(summary.service_breakdown).length === 0 && (
                        <tr><td colSpan="2" className="px-4 py-8 text-center text-slate-400 italic">No service income recorded</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Mode Breakdown */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment Collections
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(summary.payment_breakdown).map(([mode, val]) => (
                    <div key={mode} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">{mode}</span>
                      <span className="text-sm font-black text-slate-900">{formatCurrency(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Expense Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                Daily Expenses
              </h3>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Expense Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {Object.entries(summary.expense_breakdown || {}).map(([type, val]) => (
                      <tr key={type} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-700">{type}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(val)}</td>
                      </tr>
                    ))}
                    {(!summary.expense_breakdown || Object.keys(summary.expense_breakdown).length === 0) && (
                      <tr><td colSpan="2" className="px-4 py-8 text-center text-slate-400 italic">No expenses recorded for this day</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-rose-50/50">
                    <tr>
                      <td className="px-4 py-3 font-black text-slate-700">Total Expenses</td>
                      <td className="px-4 py-3 text-right font-black text-rose-700">{formatCurrency(summary.total_expenses)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FileText className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Tax Summary</p>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-8 text-xs">
                      <span className="text-slate-500">Output GST (Income):</span>
                      <span className="font-bold text-slate-700">{formatCurrency(summary.total_gst)}</span>
                    </div>
                    <div className="flex justify-between gap-8 text-xs">
                      <span className="text-slate-500">Input GST (Expense):</span>
                      <span className="font-bold text-slate-700">{formatCurrency(summary.total_expense_gst)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 z-10">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
          >
            Close
          </button>
          <button 
            onClick={() => generateDailySummaryPDF(summary)}
            className="px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Download Summary PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyBreakdownModal;
