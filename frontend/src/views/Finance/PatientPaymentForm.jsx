import React, { useState, useEffect } from 'react';
import { 
  User, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  Activity
} from 'lucide-react';
import api from '../../api';
import { 
  SectionHeader, 
  FormGroup, 
  IdentifierRow, 
  ServiceRow, 
  SettlementCard 
} from './components/FinanceFormComponents';

const PatientPaymentForm = (props) => {
  const { token, initialData, onSuccess, onUnauthorized, onToggleBulk, currentUser } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Master Data
  const [masters, setMasters] = useState({ identifiers: [], services: [], payment_modes: [] });

  // Form State
  const [formData, setFormData] = useState({
    patient_name: '',
    payment_date: new Date().toISOString().split('T')[0],
    token_no: '',
    notes: '',
    free_flag: false,
    identifiers: [{ identifier_id: '', id_value: '' }],
    services: [{ service_id: '', amount: 0 }],
    payments: [{ payment_mode_id: '', value: 0 }],
    total_amount: 0,
    gst_amount: 0
  });

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        identifiers: initialData.identifiers || [{ identifier_id: '', id_value: '' }],
        services: initialData.services || [{ service_id: '', amount: 0 }],
        payments: initialData.payments || [{ payment_mode_id: '', value: 0 }],
        payment_date: initialData.payment_date || new Date().toISOString().split('T')[0]
      });
    }
  }, [initialData]);

  const fetchMasters = async () => {
    try {
      const data = await api.getFinanceMasters(token);
      setMasters(data);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError("Failed to load master data");
    }
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  
  const addIdentifier = () => {
    setFormData({
      ...formData,
      identifiers: [...formData.identifiers, { identifier_id: '', id_value: '' }]
    });
  };

  const removeIdentifier = (index) => {
    setFormData({
      ...formData,
      identifiers: formData.identifiers.filter((_, i) => i !== index)
    });
  };

  const updateIdentifier = (index, field, value) => {
    const newIdents = [...formData.identifiers];
    newIdents[index][field] = value;
    setFormData({ ...formData, identifiers: newIdents });
  };

  const addService = () => {
    setFormData({
      ...formData,
      services: [...formData.services, { service_id: '', amount: 0 }]
    });
  };

  const removeService = (index) => {
    setFormData({
      ...formData,
      services: formData.services.filter((_, i) => i !== index)
    });
  };

  const updateService = (sIndex, field, value) => {
    const newServices = [...formData.services];
    newServices[sIndex][field] = value;
    
    const total = newServices.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    
    const newPayments = [...formData.payments];
    if (newPayments.length === 1) {
      newPayments[0].value = total;
    }
    
    setFormData({ ...formData, services: newServices, payments: newPayments, total_amount: total });
  };

  const addPayment = () => {
    setFormData({
      ...formData,
      payments: [...formData.payments, { payment_mode_id: '', value: 0 }]
    });
  };

  const removePayment = (index) => {
    setFormData({
      ...formData,
      payments: formData.payments.filter((_, i) => i !== index)
    });
  };

  const updatePayment = (pIndex, field, value) => {
    const newPayments = [...formData.payments];
    newPayments[pIndex][field] = value;
    setFormData({ ...formData, payments: newPayments });
  };

  const validateForm = () => {
    if (!formData.patient_name.trim()) return "Patient name is required";
    
    const activeServices = formData.services.filter(s => s.service_id !== '');
    if (activeServices.length === 0) return "At least one valid service is required";
    if (activeServices.some(s => s.amount <= 0)) return "All selected services must have a valid amount";
    
    if (!formData.free_flag) {
      const activePayments = formData.payments.filter(p => p.payment_mode_id !== '' || p.value > 0);
      const totalPaid = activePayments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
      
      if (totalPaid > formData.total_amount + 0.01) {
        return `Overpayment: Total received (₹${totalPaid.toLocaleString()}) exceeds the total bill (₹${formData.total_amount.toLocaleString()}).`;
      }
      
      if (activePayments.some(p => p.value > 0 && !p.payment_mode_id)) {
        return "Please select a payment mode for all recorded amounts";
      }
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const submissionData = {
        ...formData,
        token_no: formData.token_no === '' ? null : parseInt(formData.token_no),
        total_amount: parseFloat(formData.total_amount),
        gst_amount: parseFloat(formData.gst_amount || 0),
        identifiers: formData.identifiers
          .filter(idnt => idnt.identifier_id !== '' && idnt.id_value !== '')
          .map(idnt => ({
            ...idnt,
            identifier_id: parseInt(idnt.identifier_id)
          })),
        services: formData.services
          .filter(srv => srv.service_id !== '')
          .map(s => ({
            ...s,
            service_id: parseInt(s.service_id),
            amount: parseFloat(s.amount)
          })),
        payments: formData.free_flag ? [] : formData.payments
          .filter(p => p.payment_mode_id !== '')
          .map(p => ({
            ...p,
            payment_mode_id: parseInt(p.payment_mode_id),
            value: parseFloat(p.value)
          }))
      };

      await api.savePatientPayment(token, submissionData, formData.id);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError(err.message || "Failed to save payment");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setFormData({ 
      patient_name: '', 
      payment_date: new Date().toISOString().split('T')[0],
      token_no: '',
      notes: '',
      free_flag: false,
      identifiers: [{identifier_id:'', id_value:''}], 
      services: [{service_id:'', amount:0}], 
      payments: [{payment_mode_id:'', value:0}], 
      total_amount: 0,
      gst_amount: 0
    });
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100">
        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Payment Recorded!</h2>
        <p className="text-slate-500 mt-2">The patient transaction has been successfully logged.</p>
        <button 
          onClick={resetForm}
          className="mt-8 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Record Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header with Bulk Upload Toggle */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Plus className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Record New Payment</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Patient Transaction Entry</p>
          </div>
        </div>
        {onToggleBulk && currentUser?.role === 'Admin' && (
          <button 
            onClick={onToggleBulk}
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-indigo-100 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Bulk Upload
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 p-4 rounded-xl border border-red-100 text-red-700 animate-in fade-in zoom-in-95 duration-300">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SECTION 1: PATIENT INFO */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <SectionHeader icon={User} title="Patient Details" />
            <div className="p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormGroup label="Patient Name">
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                    placeholder="Enter full name"
                    value={formData.patient_name || ''}
                    onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
                  />
                </FormGroup>
                <FormGroup label="Visit Date">
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                  />
                </FormGroup>
                <FormGroup label="Token No">
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                    placeholder="Enter token number"
                    value={formData.token_no || ''}
                    onChange={(e) => setFormData({...formData, token_no: e.target.value})}
                  />
                </FormGroup>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identifiers</label>
                  <button 
                    onClick={addIdentifier}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors uppercase"
                  >
                    + Add ID
                  </button>
                </div>
                
                {formData.identifiers.map((ident, idx) => (
                  <IdentifierRow 
                    key={idx}
                    ident={{ ...ident, index: idx }}
                    masters={masters}
                    onChange={updateIdentifier}
                    onRemove={removeIdentifier}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: SERVICES */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <SectionHeader 
              icon={Activity} 
              title="Services Rendered" 
              onAction={addService}
              actionLabel="Add Service"
            />
            <div className="p-8 space-y-4">
              {formData.services.map((srv, sIdx) => (
                <ServiceRow 
                  key={sIdx}
                  srv={srv}
                  index={sIdx}
                  masters={masters}
                  onChange={updateService}
                  onRemove={removeService}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Settlement Card */}
        <div className="space-y-8">
          <SettlementCard 
            totalAmount={formData.total_amount}
            payments={formData.payments}
            isFree={formData.free_flag}
            onAddPayment={addPayment}
            onRemovePayment={removePayment}
            onUpdatePayment={updatePayment}
            onToggleFree={(val) => setFormData({...formData, free_flag: val})}
            onNotesChange={(val) => setFormData({...formData, notes: val})}
            notes={formData.notes}
            onSubmit={handleSubmit}
            loading={loading}
            masters={masters}
          />
        </div>
      </div>
    </div>
  );
};

export default PatientPaymentForm;
