import React, { useState, useEffect } from 'react';
import { Package, CreditCard, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { StatCard } from '../components/common/Common';
import { formatDate } from '../utils/dateUtils';

const DashboardHome = ({ setView, invoices = [], token, onUnauthorized = () => {} }) => {
  const [stats, setStats] = useState({
    total_medicines: 0,
    pending_invoices_amount: 0,
    monthly_procurement: 0,
    low_stock_alerts: 0
  });
  const [loading, setLoading] = useState(true);

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
        value={`₹${(stats?.pending_invoices_amount ?? 0).toLocaleString()}`} 
        trend={0} 
        color="bg-indigo-500" 
        subValue="to be paid" 
      />
      <StatCard 
        icon={TrendingUp} 
        label="Monthly Procurement" 
        value={`₹${(stats?.monthly_procurement ?? 0).toLocaleString()}`} 
        trend={8.2} 
        color="bg-green-500" 
      />
      <StatCard 
        icon={AlertCircle} 
        label="Low Stock Alert" 
        value={(stats?.low_stock_alerts ?? 0).toString()} 
        trend={-2} 
        color="bg-orange-500" 
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
              <p className="font-bold text-gray-900">₹{inv.total_value.toLocaleString()}</p>
            </div>
          ))}
          {recentInvoices.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No recent invoices.</p>
          )}
        </div>
      </div>

      <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-100 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-lg font-bold mb-2">Quick Actions</h2>
          <p className="text-blue-100 text-sm mb-6">Manage your pharmacy inventory efficiently.</p>
          <div className="space-y-3">
            <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2">
              <span>Add New Product</span>
            </button>
            <button 
              onClick={() => setView('suppliers')}
              className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-700/20"
            >
              Manage Suppliers
            </button>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
      </div>
    </div>
  </>
  );
};

export default DashboardHome;
