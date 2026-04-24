import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Tag, Trash2, Edit2, AlertCircle, 
  Check, X, Activity, CreditCard, Fingerprint,
  ToggleLeft, ToggleRight, Loader2
} from 'lucide-react';
import api from '../../api';

/**
 * Sub-component for managing a specific master data entity (Identifiers, Services, or Payment Modes).
 */
const MasterTable = ({ 
  title, 
  description, 
  items, 
  icon: Icon, 
  onSave, 
  onToggle, 
  placeholder,
  loading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const filteredItems = (items || []).filter(item => {
    const name = item.id_name || item.service_name || item.mode || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEditStart = (item) => {
    setIsEditing(item.id);
    setEditValue(item.id_name || item.service_name || item.mode || '');
    setError('');
  };

  const handleSave = (id) => {
    if (!editValue.trim()) {
      setError('Please enter a name');
      return;
    }
    
    // Duplicate check
    const isDuplicate = items.some(item => {
      const name = item.id_name || item.service_name || item.mode || '';
      return name.toLowerCase() === editValue.trim().toLowerCase() && item.id !== id;
    });

    if (isDuplicate) {
      setError('This entry already exists');
      return;
    }

    onSave({ name: editValue.trim() }, id);
    setIsEditing(null);
    setEditValue('');
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex space-x-2">
            <input 
              type="text" 
              placeholder={placeholder}
              className={`bg-white border rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium ${
                error && isEditing === 'new' ? 'border-red-500' : 'border-gray-100'
              }`}
              value={isEditing === 'new' ? editValue : ''}
              onChange={(e) => {
                setIsEditing('new');
                setEditValue(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave(null)}
            />
            <button 
              onClick={() => handleSave(null)}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-blue-300 transition-all flex items-center space-x-2"
            >
              {loading && isEditing === 'new' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              <span>Add</span>
            </button>
          </div>
          {error && isEditing === 'new' && (
            <p className="text-xs text-red-500 font-bold flex items-center">
              <AlertCircle size={12} className="mr-1" />
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search..."
              className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-2.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredItems.map(item => {
              const name = item.id_name || item.service_name || item.mode || '';
              return (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">#{item.id}</td>
                  <td className="px-6 py-4">
                    {isEditing === item.id ? (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="text" 
                            className={`bg-white border rounded-lg px-3 py-1 text-sm focus:outline-none ${
                              error ? 'border-red-500' : 'border-blue-500'
                            }`}
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setError('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave(item.id)}
                            autoFocus
                          />
                          <button onClick={() => handleSave(item.id)} className="text-sm text-blue-600 font-bold hover:text-blue-700">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                          </button>
                          <button onClick={() => { setIsEditing(null); setError(''); }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                        {error && (
                          <p className="text-[10px] text-red-500 font-bold">{error}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 text-gray-400 rounded-lg">
                          <Icon size={16} />
                        </div>
                        <span className={`font-bold ${!item.is_active ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {name}
                        </span>
                        {!item.is_active && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditStart(item)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        aria-label="edit-item"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onToggle(item.id)}
                        className={`p-2 transition-colors ${item.is_active ? 'text-gray-400 hover:text-red-500' : 'text-green-500 hover:text-green-600'}`}
                        aria-label="toggle-item"
                      >
                        {item.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MasterDataManagement = ({ token, onUnauthorized }) => {
  const [activeTab, setActiveTab] = useState('identifiers');
  const [masters, setMasters] = useState({ identifiers: [], services: [], payment_modes: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchMasters = async () => {
    if (!token) return;
    try {
      const data = await api.getFinanceMasters(token, true);
      setMasters(data);
    } catch (error) {
      if (error.message === 'Unauthorized') onUnauthorized();
      else showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, [token]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (data, id) => {
    setActionLoading(true);
    const entity = activeTab === 'identifiers' ? 'patient_identifiers' : 
                   activeTab === 'services' ? 'patient_services' : 'payment_modes';
    
    // Map internal key names to expected API field names
    const payload = {};
    if (activeTab === 'identifiers') payload.id_name = data.name;
    else if (activeTab === 'services') payload.service_name = data.name;
    else payload.mode = data.name;

    try {
      await api.saveFinanceMaster(token, entity, { ...payload, is_active: true }, id);
      showToast(id ? 'Updated successfully' : 'Added successfully');
      fetchMasters();
    } catch (error) {
      if (error.message === 'Unauthorized') onUnauthorized();
      else showToast(error.message || 'Save failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (id) => {
    setActionLoading(true);
    const entity = activeTab === 'identifiers' ? 'patient_identifiers' : 
                   activeTab === 'services' ? 'patient_services' : 'payment_modes';
    
    try {
      await api.toggleFinanceMaster(token, entity, id);
      showToast('Status updated');
      fetchMasters();
    } catch (error) {
      if (error.message === 'Unauthorized') onUnauthorized();
      else showToast('Toggle failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { id: 'identifiers', name: 'Patient Identifiers', icon: Fingerprint, count: masters.identifiers.length },
    { id: 'services', name: 'Patient Services', icon: Activity, count: masters.services.length },
    { id: 'modes', name: 'Payment Modes', icon: CreditCard, count: masters.payment_modes.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Finance Master Data</h1>
          <p className="text-gray-500 font-medium">Manage patient identification types, services, and payment modes</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex p-1.5 bg-gray-100/50 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2.5 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
              activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-right-8 duration-300 z-50 flex items-center space-x-3 font-bold ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.type === 'error' ? <X size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'identifiers' && (
          <MasterTable 
            title="Patient Identifiers"
            description="Manage unique identification types like Aadhar, MR No, etc."
            items={masters.identifiers}
            icon={Fingerprint}
            onSave={handleSave}
            onToggle={handleToggle}
            placeholder="New identifier name..."
            loading={actionLoading}
          />
        )}
        {activeTab === 'services' && (
          <MasterTable 
            title="Patient Services"
            description="Manage services rendered to patients (Consultation, Dressing, etc.)"
            items={masters.services}
            icon={Activity}
            onSave={handleSave}
            onToggle={handleToggle}
            placeholder="New service name..."
            loading={actionLoading}
          />
        )}
        {activeTab === 'modes' && (
          <MasterTable 
            title="Payment Modes"
            description="Manage supported payment methods (Cash, Card, UPI, etc.)"
            items={masters.payment_modes}
            icon={CreditCard}
            onSave={handleSave}
            onToggle={handleToggle}
            placeholder="New mode name..."
            loading={actionLoading}
          />
        )}
      </div>
    </div>
  );
};

export default MasterDataManagement;
