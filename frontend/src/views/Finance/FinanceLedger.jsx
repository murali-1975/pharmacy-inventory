import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  FileText,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import api from '../../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FinanceLedger = ({ token, onUnauthorized }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    opening_balance: 0,
    closing_balance: 0,
    entries: [],
    start_date: '',
    end_date: ''
  });

  const [filters, setFilters] = useState({
    from_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchLedger();
  }, [filters.from_date, filters.to_date]);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getLedger(token, filters.from_date, filters.to_date);
      setData(result);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError(err.message || "Failed to fetch ledger data");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelExport = async () => {
    try {
      const blob = await api.getLedgerExport(token, filters.from_date, filters.to_date, 'excel');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Ledger_${filters.from_date}_to_${filters.to_date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      alert("Failed to export Excel: " + err.message);
    }
  };

  const handlePDFExport = () => {
    try {
      const doc = new jsPDF('p', 'pt', 'a4');
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('Financial Accounting Ledger', 40, 50);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${formatDate(filters.from_date)} to ${formatDate(filters.to_date)}`, 40, 70);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 85);

      // Opening Balance
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`Opening Balance (B/F): Rs. ${(data.opening_balance || 0).toLocaleString()}`, 40, 110);

      const tableColumn = ["Date", "Details", "Credit", "Debit", "Cr GST", "Db GST", "Balance"];
      const tableRows = data.entries.map(entry => [
        formatDate(entry.date),
        entry.details || '',
        (entry.credit || 0).toLocaleString(),
        (entry.debit || 0).toLocaleString(),
        (entry.credit_gst || 0).toLocaleString(),
        (entry.debit_gst || 0).toLocaleString(),
        (entry.balance || 0).toLocaleString()
      ]);

      const tableOptions = {
        startY: 130,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255 }, // indigo-600
        styles: { fontSize: 8, cellPadding: 8 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        }
      };

      // Resilient AutoTable Call
      if (typeof doc.autoTable === 'function') {
        doc.autoTable(tableOptions);
      } else {
        autoTable(doc, tableOptions);
      }

      // Closing Balance - Safely get final Y position
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 30 : 400;
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(`Closing Balance: Rs. ${(data.closing_balance || 0).toLocaleString()}`, 40, finalY);

      doc.save(`Ledger_${filters.from_date}_to_${filters.to_date}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF report: " + err.message);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <BookOpen size={24} />
            </div>
            Accounting Ledger
          </h2>
          <p className="text-slate-500 font-medium ml-12 uppercase tracking-widest text-[10px]">Consolidated Financial Statement</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date"
              className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none w-28"
              value={filters.from_date}
              onChange={(e) => setFilters({...filters, from_date: e.target.value})}
            />
            <span className="text-slate-300 font-bold mx-1">→</span>
            <input 
              type="date"
              className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none w-28"
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
            />
          </div>
          <div className="flex gap-1 pr-1">
            <button 
              onClick={handleExcelExport}
              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Export to Excel"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={handlePDFExport}
              className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              title="Export to PDF"
            >
              <FileText size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
            <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(data.opening_balance)}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <span>Historical Balance Forward</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Movements</p>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Scale size={16} />
            </div>
          </div>
          <p className={`text-2xl font-black ${data.closing_balance - data.opening_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(data.closing_balance - data.opening_balance)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <span>Net Change for Period</span>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl shadow-slate-900/20 space-y-3 text-white">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Balance</p>
            <div className="p-2 bg-white/10 rounded-xl text-indigo-400">
              <BookOpen size={16} />
            </div>
          </div>
          <p className="text-2xl font-black">{formatCurrency(data.closing_balance)}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <span className="text-indigo-400">Current Standing</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 p-4 rounded-2xl border border-rose-100 text-rose-600">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details / Category</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit (In)</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (Out)</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">GST</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {/* Opening Balance Row */}
              <tr className="bg-indigo-50/30">
                <td className="px-8 py-4 font-bold text-slate-400 text-xs italic">{formatDate(filters.from_date)}</td>
                <td className="px-8 py-4">
                   <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">Opening Balance Brought Forward</span>
                </td>
                <td className="px-8 py-4 text-right">---</td>
                <td className="px-8 py-4 text-right">---</td>
                <td className="px-8 py-4 text-right">---</td>
                <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(data.opening_balance)}</td>
              </tr>

              {loading ? (
                <tr>
                  <td colSpan="6" className="px-8 py-32 text-center">
                    <Clock className="w-12 h-12 text-indigo-100 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest italic">Computing Ledger Aggregates...</p>
                  </td>
                </tr>
              ) : data.entries.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-8 py-32 text-center text-slate-300">
                     <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                     <p className="font-bold text-xs uppercase tracking-widest">No entries found for this period</p>
                  </td>
                </tr>
              ) : data.entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-900 text-xs">{formatDate(entry.date)}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${entry.credit > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <p className="font-bold text-slate-700 text-xs uppercase tracking-tight">{entry.details}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {entry.credit > 0 ? (
                      <div className="flex items-center justify-end gap-1.5 text-emerald-600">
                        <span className="text-xs font-black">{formatCurrency(entry.credit)}</span>
                        <ArrowUpRight size={14} />
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-8 py-5 text-right">
                    {entry.debit > 0 ? (
                      <div className="flex items-center justify-end gap-1.5 text-rose-600">
                        <span className="text-xs font-black">{formatCurrency(entry.debit)}</span>
                        <ArrowDownRight size={14} />
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex flex-col items-end">
                      {entry.credit_gst > 0 && <span className="text-[9px] font-bold text-emerald-500">Cr: {formatCurrency(entry.credit_gst)}</span>}
                      {entry.debit_gst > 0 && <span className="text-[9px] font-bold text-rose-500">Db: {formatCurrency(entry.debit_gst)}</span>}
                      {entry.credit_gst === 0 && entry.debit_gst === 0 && <span className="text-slate-300">-</span>}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="text-xs font-black text-slate-900">{formatCurrency(entry.balance)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="px-4 text-[9px] text-slate-400 italic">
        * Running balance is computed using historical carry-forward from before the selected period.
      </div>
    </div>
  );
};

export default FinanceLedger;
