import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart, Calendar, 
  Download, Loader2, AlertCircle, FileText, IndianRupee,
  ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { StatCard } from '../components/common/Common';
import { formatINR } from '../utils/formatters';

const FinancialsView = ({ token, onUnauthorized = () => {} }) => {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("overview"); // "overview" or "period"
  
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
  const [periodSummary, setPeriodSummary] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    // Date Range Validation
    if (new Date(dateRange.start) > new Date(dateRange.end)) {
      setError("Invalid Date Range: The start date cannot be after the end date.");
      setLoading(false);
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [valRes, agingRes, gstRes, profitRes, perRes] = await Promise.all([
        fetch('/api/financials/valuation', { headers }),
        fetch('/api/financials/aging', { headers }),
        fetch(`/api/financials/gst?start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers }),
        fetch(`/api/financials/profit?start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers }),
        fetch(`/api/financials/period-summary?start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers })
      ]);

      if (valRes.status === 401 || agingRes.status === 401 || gstRes.status === 401 || profitRes.status === 401 || perRes.status === 401) {
        onUnauthorized();
        return;
      }

      if (!valRes.ok || !agingRes.ok || !gstRes.ok || !profitRes.ok || !perRes.ok) {
        throw new Error("Failed to fetch one or more financial reports.");
      }

      const [valData, agingData, gstData, profitData, perData] = await Promise.all([
        valRes.json(), agingRes.json(), gstRes.json(), profitRes.json(), perRes.json()
      ]);

      setValuation(valData);
      setAging(agingData);
      setGst(gstData);
      setProfit(profitData);
      setPeriodSummary(perData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/financials/period-summary/export?start_date=${dateRange.start}&end_date=${dateRange.end}&format=excel`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Excel export failed.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Portfolio_Summary_${dateRange.start}_${dateRange.end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError("Failed to export Excel: " + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!periodSummary) return;
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const dateStr = new Date().toLocaleDateString('en-IN');
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Brand Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text("Pharmacy Inventory", 14, 22);
    
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55); // Gray-800
    doc.text("Period Portfolio Summary", 14, 32);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 40);
    doc.text(`Generated on: ${dateStr} at ${timeStr}`, 14, 46);

    const tableData = [
      ["Opening Inventory Value", formatINR(periodSummary?.opening_valuation).replace('₹', 'Rs. ')],
      ["Purchase Value Added (+)", formatINR(periodSummary?.purchases_value).replace('₹', 'Rs. ')],
      ["Initial Stock Initialized (+)", formatINR(periodSummary?.initial_stock_value).replace('₹', 'Rs. ')],
      ["Revenue from Goods Sold", formatINR(periodSummary?.revenue).replace('₹', 'Rs. ')],
      ["Cost of Goods Sold (-)", formatINR(periodSummary?.cost_of_goods_sold).replace('₹', 'Rs. ')],
      ["Movement Adjustments (+/-)", formatINR(periodSummary?.adjustments_value).replace('₹', 'Rs. ')],
      ["Stock Write-offs (-)", formatINR(periodSummary?.write_offs_value).replace('₹', 'Rs. ')],
      ["Gross Profit", formatINR(periodSummary?.gross_profit).replace('₹', 'Rs. ')],
      ["Closing Inventory Value", formatINR(periodSummary?.closing_valuation).replace('₹', 'Rs. ')]
    ];

    autoTable(doc, {
      startY: 55,
      head: [['Metric Description', 'Financial Amount (INR)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { top: 55, bottom: 20, left: 14, right: 14 }
    });

    // Final signature/footer
    const finalY = (doc).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("This is a computer-generated financial statement for auditing purposes.", 14, finalY);

    doc.save(`Portfolio_Summary_${dateRange.start}_${dateRange.end}.pdf`);
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
          value={formatINR(valuation?.total_cost_value)} 
          color="bg-indigo-600" 
          subValue={`${valuation?.batch_count || 0} Active Batches`}
        />
        <StatCard 
          icon={PieChart} 
          label="Projected Revenue" 
          value={formatINR(valuation?.total_mrp_value)} 
          color="bg-blue-600" 
          subValue="Total stock @ MRP"
        />
        <StatCard 
          icon={DollarSign} 
          label="Net GST Liability" 
          value={formatINR(gst?.net_gst_liability)} 
          color={gst?.net_gst_liability >= 0 ? "bg-orange-600" : "bg-green-600"}
          subValue={`${formatINR(gst?.output_gst)} Output collected`}
        />
        <StatCard 
          icon={IndianRupee} 
          label="Monthly Gross Profit" 
          value={formatINR(totalMonthlyProfit)} 
          color="bg-emerald-600" 
          subValue={`${((totalMonthlyProfit / totalMonthlyRevenue) * 100 || 0).toFixed(0)}% Avg Margin`}
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSubTab === "overview" 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📊 Performance Overview
        </button>
        <button
          onClick={() => setActiveSubTab("period")}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeSubTab === "period" 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📂 Period Portfolio Summary
        </button>
      </div>

      {activeSubTab === "overview" ? (
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
                      <td className="px-6 py-4 text-right font-bold">{formatINR(item.revenue)}</td>
                      <td className="px-6 py-4 text-right font-black text-green-600">{formatINR(item.gross_profit)}</td>

                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-black">
                          {item.margin_percent.toFixed(0)}%
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
                      <p className="text-lg font-black text-gray-900">{formatINR(item.balance_due)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Total Invoiced</p>
                      <p className="text-xs font-bold text-gray-500">{formatINR(item.total_invoiced)}</p>
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
      ) : (
        <div className="max-w-4xl">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Period Portfolio Summary</h3>
                <p className="text-gray-500 text-sm mt-1">Inventory movement and profitability reconciled for your chosen range.</p>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center shadow-sm"
                >
                  <FileText size={16} className="mr-2" /> Export PDF
                </button>
                <button 
                  onClick={handleExportExcel}
                  disabled={exportLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center shadow-md disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Download size={16} className="mr-2" />}
                  Export Excel
                </button>
              </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {/* Statement Items */}
              {[
                { label: "Opening Inventory Value", value: periodSummary?.opening_valuation, hint: "Value at cost at start of period", icon: Calendar, color: "text-gray-400" },
                { label: "Purchase Value Added (+)", value: periodSummary?.purchases_value, hint: "Total stock received from suppliers", icon: RefreshCw, color: "text-blue-500" },
                { label: "Initial Stock Initialized (+)", value: periodSummary?.initial_stock_value, hint: "Opening stock seeded during go-live", icon: ChevronUp, color: "text-indigo-500" },
                { label: "Revenue from Goods Sold", value: periodSummary?.revenue, hint: "Total cash/credit sales generated", icon: TrendingUp, color: "text-emerald-500" },
                { label: "Cost of Goods Sold (-)", value: periodSummary?.cost_of_goods_sold, hint: "Cost of medicines successfully dispensed", icon: ChevronDown, color: "text-orange-500" },
                { label: "Movement Adjustments (+/-)", value: periodSummary?.adjustments_value, hint: "Manual corrections & cancellations", icon: RefreshCw, color: "text-purple-500" },
                { label: "Stock Write-offs (-)", value: periodSummary?.write_offs_value, hint: "Value of expired or damaged write-offs", icon: TrendingDown, color: "text-red-500" },
                { label: "Gross Profit", value: periodSummary?.gross_profit, hint: "Revenue minus Cost of Goods Sold", icon: DollarSign, color: "text-green-600", highlighted: true },
                { label: "Closing Inventory Value", value: periodSummary?.closing_valuation, hint: "Remaining stock value at end of period", icon: PieChart, color: "text-indigo-600", highlighted: true }
              ].map((item, idx) => (
                <div key={idx} className={`flex items-start justify-between p-6 rounded-2xl ${item.highlighted ? "bg-gray-50 border border-gray-200" : "hover:bg-gray-50/50 transition-colors"}`}>
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl bg-white shadow-sm border border-gray-100 ${item.color}`}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.hint}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${item.highlighted ? "text-gray-900" : "text-gray-700"}`}>
                      {formatINR(item.value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 italic">
                Mathematical Reconciliation: Opening + Added - COGS + Net Adjustments = Closing (± fractional limits). 
                All values are calculated at <strong>Batch Purchase Cost</strong> for accuracy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsView;
