import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Calendar, 
  TrendingUp, 
  CreditCard,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import api from '../../api';

const DailySummaryReport = ({ token, onUnauthorized }) => {
  const [summaries, setSummaries] = useState([]);
  const [masters, setMasters] = useState({ services: [], payment_modes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 14)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [grandTotals, setGrandTotals] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, [dateRange.start, dateRange.end, pagination.page, pagination.pageSize]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const skip = (pagination.page - 1) * pagination.pageSize;
      const [summaryData, masterData] = await Promise.all([
        api.getDailyFinanceSummaries(token, dateRange.start, dateRange.end, skip, pagination.pageSize),
        api.getFinanceMasters(token)
      ]);
      setSummaries(summaryData.items || []);
      setGrandTotals(summaryData.grand_total);
      setPagination(prev => ({ ...prev, total: summaryData.total }));
      setMasters(masterData);
      setError(null);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized?.();
      console.error('Failed to fetch data:', err);
      setError('Could not load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Daily Financial Aggregates
          </h2>
          <p className="text-sm text-slate-500 mt-1">Consolidated revenue breakdown by services and modes</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="date"
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            />
          </div>
          <span className="text-slate-400 text-sm">to</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="date"
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
          <button 
            onClick={fetchInitialData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th rowSpan="2" className="px-6 py-4 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-100">Date</th>
                <th rowSpan="2" className="px-4 py-4 text-center border-r border-slate-100">Patients</th>
                <th colSpan={masters.services.length} className="px-4 py-2 text-center border-b border-slate-100 bg-indigo-50/30 text-indigo-600">
                  <div className="flex items-center justify-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Services Breakdown
                  </div>
                </th>
                <th colSpan={masters.payment_modes.length} className="px-4 py-2 text-center border-b border-slate-100 bg-emerald-50/30 text-emerald-600">
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="w-3 h-3" />
                    Payment Modes
                  </div>
                </th>
                <th rowSpan="2" className="px-6 py-4 text-right bg-amber-50/30 text-amber-700 border-l border-slate-100">GST</th>
                <th rowSpan="2" className="px-6 py-4 text-right bg-indigo-50/30 text-indigo-900 border-l border-slate-100 font-black">Revenue</th>
                <th rowSpan="2" className="px-6 py-4 text-right bg-emerald-50/30 text-emerald-900 border-l border-slate-100 font-black">Collected</th>
                <th rowSpan="2" className="px-6 py-4 text-right bg-rose-50/30 text-rose-900 border-l border-slate-100 font-black">Gap</th>
              </tr>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-bold uppercase tracking-wider border-b border-slate-100">
                {/* Services Sub-headers */}
                {masters.services.map(s => (
                  <th key={s.id} className="px-4 py-3 text-right font-medium border-r border-slate-100/50">{s.service_name}</th>
                ))}
                {/* Payments Sub-headers */}
                {masters.payment_modes.map(m => (
                  <th key={m.id} className="px-4 py-3 text-right font-medium border-r border-slate-100/50">{m.mode}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td colSpan={4 + masters.services.length + masters.payment_modes.length} className="px-6 py-6">
                      <div className="h-4 bg-slate-50 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={4 + masters.services.length + masters.payment_modes.length} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <FileText className="w-12 h-12" />
                      <p className="text-slate-500 italic font-medium">No summary records found for this period.</p>
                      <p className="text-xs">Summary data is generated as transactions are recorded.</p>
                    </div>
                  </td>
                </tr>
              ) : summaries.map((item) => (
                <tr key={item.summary_date} className="hover:bg-slate-50/50 transition-colors group">
                  {/* Date */}
                  <td className="px-6 py-4 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    {new Date(item.summary_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  
                  {/* Patients */}
                  <td className="px-4 py-4 text-center border-r border-slate-100">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                      {item.patient_count}
                    </span>
                  </td>

                  {/* Services Values */}
                  {masters.services.map(s => {
                    const val = item.service_breakdown[s.service_name] || 0;
                    return (
                      <td key={`${item.summary_date}-srv-${s.id}`} className={`px-4 py-4 text-right border-r border-slate-50 ${val > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'}`}>
                        {val > 0 ? formatCurrency(val) : '-'}
                      </td>
                    );
                  })}

                  {/* Payment Values */}
                  {masters.payment_modes.map(m => {
                    const val = item.payment_breakdown[m.mode] || 0;
                    return (
                      <td key={`${item.summary_date}-pm-${m.id}`} className={`px-4 py-4 text-right border-r border-slate-50 ${val > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'}`}>
                        {val > 0 ? formatCurrency(val) : '-'}
                      </td>
                    );
                  })}

                  {/* GST */}
                  <td className="px-6 py-4 text-right font-bold text-amber-600 bg-amber-50/10 border-l border-slate-100">
                    {item.total_gst > 0 ? formatCurrency(item.total_gst) : '-'}
                  </td>

                  {/* Revenue */}
                  <td className="px-6 py-4 text-right font-black text-slate-900 bg-indigo-50/10 border-l border-slate-100">
                    {formatCurrency(item.total_revenue)}
                  </td>

                  {/* Collected */}
                  <td className="px-6 py-4 text-right font-black text-emerald-700 bg-emerald-50/10 border-l border-slate-100">
                    {formatCurrency(item.total_collected)}
                  </td>

                  {/* Gap */}
                  <td className="px-6 py-4 text-right font-black text-rose-600 bg-rose-50/10 border-l border-slate-100">
                    {formatCurrency(item.total_revenue - item.total_collected)}
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && summaries.length > 0 && grandTotals && (
              <tfoot className="bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
                <tr>
                  <td className="px-6 py-4 sticky left-0 bg-slate-900 z-10 border-r border-white/10">Grand Total</td>
                  <td className="px-4 py-4 text-center border-r border-white/10">
                    {grandTotals.patient_count}
                  </td>
                  {masters.services.map(s => (
                    <td key={s.id} className="px-4 py-4 text-right border-r border-white/10">
                      {formatCurrency(grandTotals.service_breakdown[s.service_name] || 0)}
                    </td>
                  ))}
                  {masters.payment_modes.map(m => (
                    <td key={m.id} className="px-4 py-4 text-right border-r border-white/10">
                      {formatCurrency(grandTotals.payment_breakdown[m.mode] || 0)}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right border-l border-white/10 text-amber-400">
                    {formatCurrency(grandTotals.total_gst)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-white border-l border-white/10">
                    {formatCurrency(grandTotals.total_revenue)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-emerald-400 border-l border-white/10">
                    {formatCurrency(grandTotals.total_collected)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-rose-400 border-l border-white/10">
                    {formatCurrency(grandTotals.total_revenue - grandTotals.total_collected)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select 
              value={pagination.pageSize}
              onChange={(e) => setPagination({ ...pagination, pageSize: Number(e.target.value), page: 1 })}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[10, 25, 50, 100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          </div>
          <span>Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} days</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            disabled={pagination.page === 1 || loading}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {(() => {
              const totalPages = Math.ceil(pagination.total / pagination.pageSize);
              const start = Math.max(0, pagination.page - 3);
              const end = Math.min(totalPages, pagination.page + 2);
              return [...Array(totalPages)].slice(start, end).map((_, i) => {
                const pageNum = start + i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPagination({ ...pagination, page: pageNum })}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pagination.page === pageNum ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    {pageNum}
                  </button>
                );
              });
            })()}
          </div>
          <button 
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize) || loading}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center px-2">
        <p className="text-[10px] text-slate-400 italic">
          * GST is automatically calculated as 5% of Pharmacy/Medicine services as per system policy.
        </p>
        <button className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          Export to Excel
        </button>
      </div>
    </div>
  );
};

export default DailySummaryReport;
