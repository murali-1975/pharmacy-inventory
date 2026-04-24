import React, { useState, useEffect } from 'react';
import { 
  User, 
  Wallet, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Clock,
  FileText
} from 'lucide-react';
import api from '../../api';

const PatientPaymentForm = ({ token, initialData, onSuccess, onUnauthorized }) => {
  const [step, setStep] = useState(1);
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
        // Ensure data matches the expected format for editing
        services: initialData.services || [{ service_id: '', amount: 0 }],
        payments: initialData.payments || [{ payment_mode_id: '', value: 0 }],
        payment_date: initialData.payment_date || new Date().toISOString().split('T')[0]
      });
      setStep(1);
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
    
    // Auto-calculate total amount based on service values
    const total = newServices.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    
    // If it's a single payment, auto-fill the value
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

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Clean up data before sending
      const submissionData = {
        ...formData,
        token_no: formData.token_no === '' ? null : parseInt(formData.token_no),
        total_amount: parseFloat(formData.total_amount),
        gst_amount: parseFloat(formData.gst_amount || 0),
        // Filter out empty identifiers
        identifiers: formData.identifiers
          .filter(idnt => idnt.identifier_id !== '' && idnt.id_value !== '')
          .map(idnt => ({
            ...idnt,
            identifier_id: parseInt(idnt.identifier_id)
          })),
        // Filter out empty services
        services: formData.services
          .filter(srv => srv.service_id !== '')
          .map(s => ({
            ...s,
            service_id: parseInt(s.service_id),
            amount: parseFloat(s.amount)
          })),
        // Filter out empty payments
        payments: formData.free_flag ? [] : formData.payments
          .filter(p => p.payment_mode_id !== '')
          .map(p => ({
            ...p,
            payment_mode_id: parseInt(p.payment_mode_id),
            value: parseFloat(p.value)
          }))
      };

      await api.savePatientPayment(token, submissionData);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError(err.message || "Failed to save payment");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render Steps
  // -------------------------------------------------------------------------

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100">
        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Payment Recorded!</h2>
        <p className="text-slate-500 mt-2">The patient transaction has been successfully logged.</p>
        <button 
          onClick={() => { 
            setSuccess(false); 
            setStep(1); 
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
          }}
          className="mt-8 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Record Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-slate-50 border-b border-slate-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {[
            { n: 1, label: 'Patient Info', icon: User },
            { n: 2, label: 'Services', icon: Activity },
            { n: 3, label: 'Payment', icon: Wallet }
          ].map((s) => (
            <div key={s.n} className={`flex items-center gap-2 ${step >= s.n ? 'text-indigo-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step >= s.n ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                {step > s.n ? <CheckCircle className="w-5 h-5" /> : s.n}
              </div>
              <span className="text-sm font-semibold hidden md:inline">{s.label}</span>
              {s.n < 3 && <div className={`w-12 h-0.5 rounded ${step > s.n ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Step {step} of 3
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 p-4 rounded-xl border border-red-100 text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* STEP 1: PATIENT INFO */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Patient Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Full name"
                  value={formData.patient_name}
                  onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                  />
                  <Activity className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Identifiers (UHID, RCH, etc.)
                </label>
                <button 
                  onClick={addIdentifier}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded transition-colors"
                >
                  + Add ID
                </button>
              </div>
              
              {formData.identifiers.map((ident, idx) => (
                <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-left-4">
                  <select 
                    className="w-1/3 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={ident.identifier_id}
                    onChange={(e) => updateIdentifier(idx, 'identifier_id', e.target.value)}
                  >
                    <option value="">Select ID Type</option>
                    {masters.identifiers.map(i => <option key={i.id} value={i.id}>{i.id_name}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder="Enter ID value"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={ident.id_value}
                    onChange={(e) => updateIdentifier(idx, 'id_value', e.target.value)}
                  />
                  <button onClick={() => removeIdentifier(idx)} className="p-2 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SERVICES */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Select Services Rendered
              </h3>
              <button 
                onClick={addService}
                className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>

            <div className="space-y-4">
              {formData.services.map((srv, sIdx) => (
                <div key={sIdx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 relative group">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Type</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-semibold"
                        value={srv.service_id}
                        onChange={(e) => updateService(sIdx, 'service_id', e.target.value)}
                      >
                        <option value="">Choose Service...</option>
                        {masters.services.map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                      </select>
                    </div>
                    
                    <div className="w-full md:w-40 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (₹)</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                        placeholder="0.00"
                        value={srv.amount}
                        onChange={(e) => updateService(sIdx, 'amount', e.target.value)}
                      />
                    </div>

                    <button 
                      onClick={() => removeService(sIdx)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Remove Service"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50 flex justify-between items-center">
              <span className="text-sm font-bold text-indigo-700">Subtotal Amount</span>
              <span className="text-lg font-black text-indigo-900">₹{formData.total_amount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                Payment Breakdown
              </h3>
              <button 
                onClick={addPayment}
                className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Mode
              </button>
            </div>

            <div className="space-y-4">
              {formData.payments.map((pm, pIdx) => (
                <div key={pIdx} className="flex gap-4 items-end animate-in fade-in slide-in-from-right-4">
                  <div className="flex-1 space-y-1">
                    {pIdx === 0 && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>}
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-semibold"
                      value={pm.payment_mode_id}
                      onChange={(e) => updatePayment(pIdx, 'payment_mode_id', e.target.value)}
                    >
                      <option value="">Select Mode...</option>
                      {masters.payment_modes.map(m => <option key={m.id} value={m.id}>{m.mode}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    {pIdx === 0 && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (₹)</label>}
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input 
                        type="number"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                        placeholder="0.00"
                        value={pm.value}
                        onChange={(e) => updatePayment(pIdx, 'value', e.target.value)}
                      />
                    </div>
                  </div>

                  {formData.payments.length > 1 && (
                    <button 
                      onClick={() => removePayment(pIdx)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Total Bill</span>
                <span className="text-slate-900 font-bold">₹{formData.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Total Received</span>
                <span className={`font-bold ${Math.abs(formData.payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0) - formData.total_amount) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  ₹{formData.payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0).toLocaleString()}
                </span>
              </div>
              {Math.abs(formData.payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0) - formData.total_amount) > 0.01 && (
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider text-right pt-1">
                  Remaining: ₹{(formData.total_amount - formData.payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0)).toLocaleString()}
                </div>
              )}
            </div>

            {/* TOTALS */}
            <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Amount Payable</span>
                <div className="text-4xl font-black text-slate-900 tracking-tight">₹{formData.total_amount.toLocaleString()}</div>
              </div>
              <div className="space-y-2 text-right">
                <div className="flex items-center gap-2 text-slate-500">
                  <input 
                    type="checkbox" 
                    id="free_flag" 
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                    checked={formData.free_flag}
                    onChange={(e) => setFormData({...formData, free_flag: e.target.checked})}
                  />
                  <label htmlFor="free_flag" className="text-sm font-medium">Free / Charity</label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-slate-50 border-t border-slate-100 px-8 py-6 flex items-center justify-between">
        <button 
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className={`flex items-center gap-2 font-bold px-4 py-2 rounded-lg transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {step < 3 ? (
          <button 
            onClick={() => {
              if (step === 1 && !formData.patient_name) { setError("Patient name is required"); return; }
              if (step === 2) {
                if (formData.services.some(s => !s.service_id || s.amount <= 0)) {
                  setError("Please select a service and enter a valid amount for all rows.");
                  return;
                }
              }
              setError(null);
              setStep(s => s + 1);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            Continue
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={() => {
              if (!formData.free_flag) {
                const totalPaid = formData.payments.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
                if (Math.abs(totalPaid - formData.total_amount) > 0.01) {
                  setError(`Payment imbalance: Total received (₹${totalPaid}) must match total bill (₹${formData.total_amount}).`);
                  return;
                }
                if (formData.payments.some(p => !p.payment_mode_id)) {
                  setError("Please select a payment mode for all payment rows.");
                  return;
                }
              }
              handleSubmit();
            }}
            disabled={loading || formData.total_amount === 0}
            className="flex items-center gap-2 bg-indigo-600 text-white font-bold px-8 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Clock className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Confirm & Save
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientPaymentForm;
