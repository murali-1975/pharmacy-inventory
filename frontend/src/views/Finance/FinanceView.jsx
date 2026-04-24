import React, { useState } from 'react';
import { 
  History, 
  Plus, 
  Database, 
  UploadCloud,
  ChevronRight,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import MasterDataManagement from './MasterDataManagement';
import PaymentHistoryTable from './PaymentHistoryTable';
import PatientPaymentForm from './PatientPaymentForm';
import FinanceDashboard from './FinanceDashboard';
import FinanceBulkUpload from './FinanceBulkUpload';
import PaymentDetailsModal from './PaymentDetailsModal';
import api from '../../api';

const FinanceView = ({ token, currentUser, onUnauthorized }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [masters, setMasters] = useState({ identifiers: [], services: [], payment_modes: [] });

  React.useEffect(() => {
    const fetchMasters = async () => {
      try {
        const data = await api.getFinanceMasters(token);
        setMasters(data);
      } catch (err) {
        if (err.message === 'Unauthorized') onUnauthorized();
      }
    };
    fetchMasters();
  }, [token]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp, role: 'Staff' },
    { id: 'history', label: 'Payment History', icon: History, role: 'Staff' },
    { id: 'record', label: 'Record Payment', icon: Plus, role: 'Staff' },
    { id: 'bulk', label: 'Bulk Upload', icon: UploadCloud, role: 'Admin' },
    { id: 'masters', label: 'Master Data', icon: Database, role: 'Admin' }
  ];

  const filteredTabs = tabs.filter(tab => 
    tab.role === 'Staff' || (tab.role === 'Admin' && currentUser?.role === 'Admin')
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <FinanceDashboard token={token} onUnauthorized={onUnauthorized} />;
      case 'history':
        return (
          <PaymentHistoryTable 
            token={token} 
            onEdit={(payment) => { setEditingPayment(payment); setActiveTab('record'); }}
            onView={(payment) => { setViewingPayment(payment); }}
            onAdd={() => { setEditingPayment(null); setActiveTab('record'); }}
            onUnauthorized={onUnauthorized}
          />
        );
      case 'record':
        return (
          <PatientPaymentForm 
            token={token} 
            initialData={editingPayment}
            onSuccess={() => setActiveTab('history')}
            onUnauthorized={onUnauthorized}
          />
        );
      case 'masters':
        return <MasterDataManagement token={token} onUnauthorized={onUnauthorized} />;
      case 'bulk':
        return <FinanceBulkUpload token={token} onUnauthorized={onUnauthorized} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Module Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Wallet className="w-64 h-64 text-white" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm tracking-widest uppercase">
            <TrendingUp className="w-4 h-4" />
            Finance Management
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Financial Operations</h1>
          <p className="text-indigo-100/60 max-w-xl text-lg font-medium leading-relaxed">
            Record patient payments, manage service master data, and analyze revenue flow with enterprise-grade precision.
          </p>
        </div>

        {/* Quick Stats Overlay (Visual only for now) */}
        <div className="mt-8 flex gap-6">
          <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-300" />
            <span className="text-white font-bold">120 Patients Today</span>
          </div>
          <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-emerald-300" />
            <span className="text-white font-bold">₹45,200 Collected</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit shadow-inner border border-slate-200">
        {filteredTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
              activeTab === tab.id 
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {renderContent()}
      </div>

      {/* Details Modal */}
      {viewingPayment && (
        <PaymentDetailsModal 
          payment={viewingPayment}
          masters={masters}
          onClose={() => setViewingPayment(null)}
        />
      )}
    </div>
  );
};

export default FinanceView;
