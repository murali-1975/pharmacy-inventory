import React, { useState } from 'react';
import { 
  History, 
  Plus, 
  Database,
  TrendingUp
} from 'lucide-react';
import MasterDataManagement from './MasterDataManagement';
import PaymentHistoryTable from './PaymentHistoryTable';
import PatientPaymentForm from './PatientPaymentForm';
import FinanceDashboard from './FinanceDashboard';
import FinanceBulkUpload from './FinanceBulkUpload';
import PaymentDetailsModal from './PaymentDetailsModal';
import api from '../../api';

import DailySummaryReport from './DailySummaryReport';

const FinanceView = ({ token, currentUser, onUnauthorized, subTab, setActiveTab }) => {
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [masters, setMasters] = useState({ identifiers: [], services: [], payment_modes: [] });
  const [showBulkUpload, setShowBulkUpload] = useState(false);

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

  // Reset bulk upload view when changing sub-tabs
  React.useEffect(() => {
    setShowBulkUpload(false);
  }, [subTab]);

  const renderContent = () => {
    const commonProps = {
      token,
      currentUser,
      onEdit: (payment) => { setEditingPayment(payment); setActiveTab('finance-record'); },
      onView: (payment) => { setViewingPayment(payment); },
      onAdd: () => { setEditingPayment(null); setActiveTab('finance-record'); },
      onUnauthorized
    };

    switch (subTab) {
      case 'dashboard':
        if (currentUser?.role !== 'Admin') return <PaymentHistoryTable {...commonProps} />;
        return <FinanceDashboard token={token} onUnauthorized={onUnauthorized} />;
      case 'summary':
        if (currentUser?.role !== 'Admin') return <PaymentHistoryTable {...commonProps} />;
        return <DailySummaryReport token={token} onUnauthorized={onUnauthorized} />;
      case 'history':
        return <PaymentHistoryTable {...commonProps} />;
      case 'record':
        return showBulkUpload ? (
          <div className="space-y-4">
            <div className="flex justify-start">
              <button 
                onClick={() => setShowBulkUpload(false)}
                className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4 rotate-45" />
                Back to Form
              </button>
            </div>
            <FinanceBulkUpload token={token} onUnauthorized={onUnauthorized} />
          </div>
        ) : (
          <PatientPaymentForm 
            token={token} 
            initialData={editingPayment}
            onSuccess={() => setActiveTab('finance-history')}
            onUnauthorized={onUnauthorized}
            onToggleBulk={() => setShowBulkUpload(true)}
            currentUser={currentUser}
          />
        );
      case 'masters':
        if (currentUser?.role !== 'Admin') return <PaymentHistoryTable {...commonProps} />;
        return <MasterDataManagement token={token} onUnauthorized={onUnauthorized} />;
      default:
        return <FinanceDashboard token={token} onUnauthorized={onUnauthorized} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Content Area */}
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
