import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart, Calendar, 
  Download, Loader2, AlertCircle, FileText, IndianRupee,
  ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';
import { StatCard } from '../components/common/Common';

const FinancialsView = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date range defaults to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];
  
  const [dateRange, setDateRange] = useState({
    start: firstDay,
    end: lastDay
  });

  const [valuation, setValuation] = useState(null);
  const [aging, setAging] = useState([]);
  const [gst, setGst] = useState(null);
  const [profit, setProfit] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [valRes, agingRes, gstRes, profitRes] = await Promise.all([
        fetch('/api/financials/valuation', { headers }),
        fetch('/api/financials/aging', { headers }),
        fetch(`/api/financials/gst?start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers }),
        fetch(`/api/financials/profit?start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers })
      ]);

      if (!valRes.ok || !agingRes.ok || !gstRes.ok || !profitRes.ok) {
        throw new Error("Failed to fetch one or more financial reports.");
      }

      const [valData, agingData, gstData, profitData] = await Promise.all([
        valRes.json(), agingRes.json(), gstRes.json(), profitRes.json()
      ]);

      setValuation(valData);
      setAging(agingData);
      setGst(gstData);
      setProfit(profitData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token, dateRange]);

  if (loading && !valuation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium font-inter">Crunching financial data...</p>
      </div>
    );
  }

  const totalMonthlyRevenue = profit.reduce((sum, item) => sum + item.revenue, 0);
  const totalMonthlyProfit = profit.reduce((sum, item) => sum + item.gross_profit, 0);

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-500">Comprehensive business analytics for administrative oversight</p>
        </div>
        <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center px-3 space-x-2 text-gray-400 border-r border-gray-100">
            <Calendar size={18} />
          </div>
          <input 
            type="date" 
            className="border-none focus:ring-0 text-sm font-bold text-gray-700 bg-transparent"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
          />
          <span className="text-gray-300 font-bold">to</span>
          <input 
            type="date" 
            className="border-none focus:ring-0 text-sm font-bold text-gray-700 bg-transparent"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
          />
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-gray-50 rounded-xl text-blue-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* KPI Overviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={TrendingUp} 
          label="Inventory Value (Cost)" 
          value={`₹${valuation?.total_cost_value.toLocaleString()}`} 
          color="bg-indigo-600" 
          subValue={`${valuation?.batch_count} Active Batches`}
        />
        <StatCard 
          icon={PieChart} 
          label="Projected Revenue" 
          value={`₹${valuation?.total_mrp_value.toLocaleString()}`} 
          color="bg-blue-600" 
          subValue="Total stock @ MRP"
        />
        <StatCard 
          icon={DollarSign} 
          label="Net GST Liability" 
          value={`₹${gst?.net_gst_liability.toLocaleString()}`} 
          color={gst?.net_gst_liability >= 0 ? "bg-orange-600" : "bg-green-600"}
          subValue={`${gst?.output_gst.toLocaleString()} Output collected`}
        />
        <StatCard 
          icon={IndianRupee} 
          label="Monthly Gross Profit" 
          value={`₹${totalMonthlyProfit.toLocaleString()}`} 
          color="bg-emerald-600" 
          subValue={`${((totalMonthlyProfit / totalMonthlyRevenue) * 100 || 0).toFixed(1)}% Avg Margin`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profitability Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 flex items-center">
              <TrendingUp size={20} className="mr-2 text-green-500" />
              Profitability by Medicine
            </h3>
            <button className="text-sm text-blue-600 font-bold hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors flex items-center">
              <Download size={14} className="mr-1" /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-6 py-4">Medicine</th>
                  <th className="px-6 py-4 text-center">Qty Sold</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                  <th className="px-6 py-4 text-right">Gross Profit</th>
                  <th className="px-6 py-4 text-center">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {profit.map(item => (
                  <tr key={item.medicine_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{item.medicine_name}</td>
                    <td className="px-6 py-4 text-center text-gray-500 font-medium">{item.quantity_sold}</td>
                    <td className="px-6 py-4 text-right font-bold">₹{item.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-black text-green-600">₹{item.gross_profit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-black">
                        {item.margin_percent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {profit.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400 italic">No sales recorded for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supplier Aging Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center">
              <RefreshCw size={20} className="mr-2 text-blue-500" />
              Supplier Aging
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {aging.map(item => (
              <div key={item.supplier_id} className="p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{item.supplier_name}</h4>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    item.balance_due > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {item.balance_due > 0 ? 'DUE' : 'CLEAR'}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Balance Due</p>
                    <p className="text-lg font-black text-gray-900">₹{item.balance_due.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Total Invoiced</p>
                    <p className="text-xs font-bold text-gray-500">₹{item.total_invoiced.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {aging.length === 0 && (
              <p className="text-center py-10 text-gray-400 italic">No supplier data found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialsView;
