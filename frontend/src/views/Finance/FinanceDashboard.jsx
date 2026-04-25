import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Wallet, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  CreditCard,
  Target,
  RefreshCcw,
  ChevronRight
} from 'lucide-react';
import api from '../../api';

const FinanceDashboard = ({ token, onUnauthorized }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    fetchStats();
  }, [token, dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getFinanceDashboardStats(token, dateRange.start, dateRange.end);
      setStats(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError("Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Syncing Financial Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center max-w-lg mx-auto mt-12">
        <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-bold text-red-900 mb-2">Analytics Error</h3>
        <p className="text-red-700/70 mb-6">{error}</p>
        <button 
          onClick={fetchStats}
          className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  const calculateTrend = (current, previous, isPercentage = true) => {
    if (previous === 0) return current > 0 ? (isPercentage ? "+100%" : `+${current}`) : (isPercentage ? "0%" : "0");
    const diff = current - previous;
    if (isPercentage) {
      const pct = (diff / previous) * 100;
      return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
    return `${diff > 0 ? '+' : ''}${diff}`;
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Date Range Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 tracking-tight">Time Horizon</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Filter Analytics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</span>
            <input 
              type="date"
              data-testid="start-date-picker"
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</span>
            <input 
              type="date"
              data-testid="end-date-picker"
              className="bg-transparent border-none outline-none text-xs font-bold text-slate-700"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />
          <button 
            onClick={handleSetToday}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            Today
          </button>
          <button 
            onClick={() => setDateRange({ start: '', end: '' })}
            className="px-4 py-2 text-slate-400 hover:text-slate-600 text-xs font-black uppercase tracking-widest transition-all"
          >
            Reset
          </button>
        </div>
      </div>
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          label="Total Revenue (Month)" 
          value={`₹${stats.total_income_month.toLocaleString()}`} 
          subLabel="MTD vs Prev. Month"
          trend={calculateTrend(stats.total_income_month, stats.total_income_prev_month_mtd)}
          positive={stats.total_income_month >= stats.total_income_prev_month_mtd}
          icon={Wallet}
          color="indigo"
        />
        <MetricCard 
          label="Revenue Today" 
          value={`₹${stats.total_income_today.toLocaleString()}`} 
          subLabel="vs. Yesterday"
          trend={calculateTrend(stats.total_income_today, stats.total_income_yesterday)}
          positive={stats.total_income_today >= stats.total_income_yesterday}
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard 
          label="Patient Visits" 
          value={stats.patient_count_today} 
          subLabel="vs. Yesterday"
          trend={calculateTrend(stats.patient_count_today, stats.patient_count_yesterday, false)}
          positive={stats.patient_count_today >= stats.patient_count_yesterday}
          icon={Users}
          color="amber"
        />
        <MetricCard 
          label="Avg. Ticket Size" 
          value={`₹${Math.round(stats.avg_ticket_size).toLocaleString()}`} 
          subLabel="vs. Yesterday"
          trend={calculateTrend(stats.avg_ticket_size, stats.avg_ticket_yesterday)}
          positive={stats.avg_ticket_size >= stats.avg_ticket_yesterday}
          icon={Target}
          color="rose"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Service Distribution Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Income by Service</h3>
              <p className="text-sm text-slate-400 font-medium mt-1">
                {dateRange.start || dateRange.end 
                  ? `Revenue contribution from ${dateRange.start || 'Beginning'} to ${dateRange.end || 'Today'}`
                  : 'Service-wise revenue contribution this month'}
              </p>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl flex gap-1">
              <button className="px-3 py-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-xs font-bold text-indigo-600">Month</button>
              <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-600">Quarter</button>
            </div>
          </div>

          <div className="space-y-6">
            {stats.service_distribution.length > 0 ? (
              stats.service_distribution.map((srv, idx) => {
                const percentage = Math.round((srv.total_amount / stats.total_income_month) * 100) || 0;
                return (
                  <div key={idx} className="group">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="font-bold text-slate-700">{srv.service_name}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">
                          {srv.count} cases
                        </span>
                      </div>
                      <span className="font-black text-slate-900">₹{srv.total_amount.toLocaleString()}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-slate-400 text-right">{percentage}% of total</div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <Activity className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No service data available for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Modes Distribution */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Payment Modes</h3>
          <p className="text-sm text-slate-400 font-medium mb-8">Preferred collection methods</p>

          <div className="flex-1 space-y-4">
            {stats.payment_mode_distribution.length > 0 ? (
              stats.payment_mode_distribution.map((mode, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all cursor-default group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      {mode.mode_name.toLowerCase().includes('cash') ? <Wallet className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">{mode.mode_name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mode.count} Transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">₹{mode.total_value.toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <RefreshCcw className="w-8 h-8 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">Waiting for data...</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="bg-indigo-900 rounded-2xl p-6 relative overflow-hidden group hover:shadow-lg hover:shadow-indigo-200 transition-all cursor-pointer">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform">
                <TrendingUp className="w-24 h-24 text-white" />
              </div>
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Growth Action</p>
                  <p className="text-white font-bold">Export Revenue Report</p>
                </div>
                <ChevronRight className="w-5 h-5 text-indigo-300" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trends / Mini Line Chart (CSS representation) */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,#312e81,transparent)] opacity-40" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Daily Trend</span>
            </div>
            <h3 className="text-3xl font-black tracking-tight">Last 7 Days Revenue</h3>
            <p className="text-slate-400 font-medium">Visualization of collection velocity</p>
          </div>

          <div className="flex items-end gap-3 h-32 flex-1 max-w-xl w-full">
            {stats.recent_trends.map((day, idx) => {
              const max = Math.max(...stats.recent_trends.map(t => t.amount)) || 1;
              const height = (day.amount / max) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="relative w-full h-full flex items-end">
                    <div 
                      className="w-full bg-indigo-500/30 group-hover:bg-indigo-500/50 rounded-t-lg transition-all duration-700"
                      style={{ height: `${height}%` }}
                    />
                    <div 
                      className="absolute bottom-0 w-full bg-indigo-400 group-hover:bg-indigo-300 rounded-t-lg transition-all duration-1000 shadow-[0_-4px_12px_rgba(129,140,248,0.3)]"
                      style={{ height: `${Math.min(height, 8)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[10px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      ₹{day.amount.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                    {day.date.split('-')[2]}/{day.date.split('-')[1]}
                  </span>
                </div>
              );
            })}
            {stats.recent_trends.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-slate-600 font-bold uppercase tracking-widest text-xs">
                No trend data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, subLabel, trend, positive, icon: Icon, color }) => {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600"
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group hover:border-indigo-100 transition-all hover:translate-y-[-4px]">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-black ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
      </div>
      <p className="text-xs text-slate-400 font-medium mt-4">{subLabel}</p>
    </div>
  );
};

export default FinanceDashboard;
