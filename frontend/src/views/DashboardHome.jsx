import React, { useState, useEffect } from 'react';
import { Package, CreditCard, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { StatCard } from '../components/common/Common';
import { formatDate } from '../utils/dateUtils';
import { formatINR } from '../utils/formatters';

const DashboardHome = ({ setView, invoices = [], token, onUnauthorized = () => {} }) => {
  const [stats, setStats] = useState({
    total_medicines: 0,
    pending_invoices_amount: 0,
    monthly_procurement: 0,
    low_stock_alerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStats();
    }
  }, [token]);

  useEffect(() => {
    const fetchLowStock = async () => {
      setLowStockLoading(true);
      try {
        const response = await fetch('/api/stock/?low_stock_only=true&limit=5', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setLowStockItems(data.items);
        }
      } catch (error) {
        console.error("Failed to fetch low stock items:", error);
      } finally {
        setLowStockLoading(false);
      }
    };

    if (token) {
      fetchLowStock();
    }
  }, [token, onUnauthorized]);

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/stock/?low_stock_only=true&limit=5000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const items = data.items;
        
        // Header
        let csvContent = "Product Name,Generic Name,Category,Quantity on Hand,Reorder Level,UOM\n";
        
        // Rows
        items.forEach(item => {
          const row = [
            `"${item.medicine?.product_name || ''}"`,
            `"${item.medicine?.generic_name || ''}"`,
            `"${item.medicine?.category || ''}"`,
            item.quantity_on_hand,
            item.reorder_level || 0,
            `"${item.medicine?.uom || ''}"`
          ].join(",");
          csvContent += row + "\n";
        });

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = 'none';
        link.setAttribute("href", url);
        link.setAttribute("download", `Low_Stock_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
      }
    } catch (error) {
      console.error("CSV Export failed:", error);
    }
  };

  const recentInvoices = invoices.slice(0, 5);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard 
        icon={Package} 
        label="Total Medicines" 
        value={(stats?.total_medicines ?? 0).toString()} 
        trend={12} 
        color="bg-blue-500" 
        subValue="in stock" 
      />
      <StatCard 
        icon={CreditCard} 
        label="Pending Payments" 
        value={formatINR(stats?.pending_invoices_amount)} 
        trend={0} 
        color="bg-indigo-500" 
        subValue="to be paid" 
      />
      <StatCard 
        icon={TrendingUp} 
        label="Monthly Procurement" 
        value={formatINR(stats?.monthly_procurement)} 
        trend={8.2} 
        color="bg-green-500" 
      />
      <StatCard 
        icon={AlertCircle} 
        label="Low Stock Alert" 
        value={(stats?.low_stock_alerts ?? 0).toString()} 
        trend={-2} 
        color="bg-orange-500" 
        onClick={() => {
          const element = document.getElementById('low-stock-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            element.classList.add('ring-2', 'ring-blue-400');
            setTimeout(() => element.classList.remove('ring-2', 'ring-blue-400'), 2000);
          }
        }}
      />
    </div>

    {/* Recent Activities & Quick Actions */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">Recent Invoices</h2>
          <button 
            onClick={() => setView('invoices')}
            className="text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors"
          >
            View All
          </button>
        </div>
        <div className="space-y-4">
          {recentInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{inv.reference_number}</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span className="font-medium text-blue-600">{inv.supplier?.supplier_name || 'Unknown Supplier'}</span>
                    <span>•</span>
                    <span>{formatDate(inv.invoice_date)}</span>
                  </div>
                </div>
              </div>
              <p className="font-bold text-gray-900">{formatINR(inv.total_value)}</p>
            </div>
          ))}
          {recentInvoices.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No recent invoices.</p>
          )}
        </div>
      </div>

      <div id="low-stock-section" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all duration-500">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Low Stock Items</h2>
            <p className="text-xs text-gray-500 mt-1">Items requiring immediate reorder</p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <button 
              onClick={() => setView('stock')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              View All
            </button>
            <button 
              onClick={handleExportCSV}
              className="text-xs text-green-600 font-bold hover:underline flex items-center space-x-1"
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {lowStockLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (lowStockItems || []).length > 0 ? (
            (lowStockItems || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <AlertCircle size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-none">
                      {item.medicine?.product_name}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                      {item.medicine?.category}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600 leading-none">
                    {item.quantity_on_hand}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Threshold: {item.reorder_level}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Inventory is healthy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
};

export default DashboardHome;
