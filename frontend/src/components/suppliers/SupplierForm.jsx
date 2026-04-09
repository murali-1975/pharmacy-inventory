import React, { useState } from 'react';
import { Database, Tag, Shield, Building2, User, Phone, Mail, MapPin, Info } from 'lucide-react';

const SupplierForm = ({ 
  initialData, 
  statuses, 
  types, 
  onSave, 
  onCancel 
}) => {
  // Initialize state with granular contact details
  const [formData, setFormData] = useState(initialData || {
    supplier_name: '',
    type_id: types[0]?.id || '',
    status_id: statuses[0]?.id || '',
    contact_details: {
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      pin_code: '',
      phone_number: '',
      email_id: '',
      contact_name: '',
      gstn: '',
      remarks: ''
    },
    bank_details: [{
      account_number: '',
      ifsc_code: '',
      bank_name: ''
    }]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateContact = (field, value) => {
    setFormData({
      ...formData,
      contact_details: {
        ...formData.contact_details,
        [field]: value
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="supplier_name" className="text-sm font-bold text-gray-700">Supplier Name</label>
          <div className="relative group">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              id="supplier_name"
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.supplier_name}
              onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
              placeholder="Legal company name"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="gstn" className="text-sm font-bold text-gray-700">GST Number</label>
          <input 
            id="gstn"
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            value={formData.contact_details?.gstn || ''}
            onChange={(e) => updateContact('gstn', e.target.value)}
            placeholder="22AAAAA0000A1Z5"
          />
        </div>
      </div>

      {/* Contact Person & Info */}
      <div className="p-6 bg-gray-50/50 rounded-3xl border border-gray-100/50 space-y-6">
        <h3 className="font-bold text-gray-900 flex items-center">
            <User size={18} className="mr-2 text-blue-500" />
            Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Person</label>
                <input 
                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none transition-all shadow-sm"
                    value={formData.contact_details?.contact_name || ''}
                    onChange={(e) => updateContact('contact_name', e.target.value)}
                    placeholder="John Doe"
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 outline-none transition-all shadow-sm"
                        value={formData.contact_details?.phone_number || ''}
                        onChange={(e) => updateContact('phone_number', e.target.value)}
                        placeholder="+91 9876543210"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email ID</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 outline-none transition-all shadow-sm"
                        value={formData.contact_details?.email_id || ''}
                        onChange={(e) => updateContact('email_id', e.target.value)}
                        placeholder="contact@supplier.com"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Address Details */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-900 flex items-center">
            <MapPin size={18} className="mr-2 text-blue-500" />
            Address Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              placeholder="Address Line 1"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_details?.address_line_1 || ''}
              onChange={(e) => updateContact('address_line_1', e.target.value)}
            />
            <input 
              placeholder="Address Line 2 (Optional)"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_details?.address_line_2 || ''}
              onChange={(e) => updateContact('address_line_2', e.target.value)}
            />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input 
              placeholder="City"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_details?.city || ''}
              onChange={(e) => updateContact('city', e.target.value)}
            />
            <input 
              placeholder="State"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_details?.state || ''}
              onChange={(e) => updateContact('state', e.target.value)}
            />
            <input 
              placeholder="Pin Code"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_details?.pin_code || ''}
              onChange={(e) => updateContact('pin_code', e.target.value)}
            />
            <div className="relative group">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                <select 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:border-blue-500 outline-none transition-all appearance-none"
                    value={formData.type_id}
                    onChange={(e) => setFormData({...formData, type_id: parseInt(e.target.value)})}
                >
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* Status & Bank Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
            <label htmlFor="status_id" className="text-sm font-bold text-gray-700">Status</label>
            <div className="relative group">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select 
                id="status_id"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:border-blue-500 outline-none transition-all appearance-none"
                value={formData.status_id}
                onChange={(e) => setFormData({...formData, status_id: parseInt(e.target.value)})}
                >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
        </div>
        <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Remarks</label>
            <div className="relative group">
                <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:border-blue-500 outline-none transition-all"
                    value={formData.contact_details?.remarks || ''}
                    onChange={(e) => updateContact('remarks', e.target.value)}
                    placeholder="Internal notes..."
                />
            </div>
        </div>
      </div>

      {/* Bank Account Details */}
      <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
        <h3 className="font-bold text-blue-900 mb-4 flex items-center">
          <Database size={18} className="mr-2" />
          Bank Account Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            placeholder="Account Number"
            className="bg-white border-blue-100 border px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.bank_details?.[0]?.account_number || ''}
            onChange={(e) => {
              const newBanks = [...(formData.bank_details || [{ account_number: '', ifsc_code: '', bank_name: '' }])];
              if (newBanks.length === 0) newBanks.push({ account_number: '', ifsc_code: '', bank_name: '' });
              newBanks[0].account_number = e.target.value;
              setFormData({...formData, bank_details: newBanks});
            }}
          />
          <input 
            placeholder="IFSC Code"
            className="bg-white border-blue-100 border px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.bank_details?.[0]?.ifsc_code || ''}
            onChange={(e) => {
              const newBanks = [...(formData.bank_details || [{ account_number: '', ifsc_code: '', bank_name: '' }])];
              if (newBanks.length === 0) newBanks.push({ account_number: '', ifsc_code: '', bank_name: '' });
              newBanks[0].ifsc_code = e.target.value;
              setFormData({...formData, bank_details: newBanks});
            }}
          />
          <input 
            placeholder="Bank Name"
            className="bg-white border-blue-100 border px-4 py-3 rounded-xl md:col-span-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.bank_details?.[0]?.bank_name || ''}
            onChange={(e) => {
              const newBanks = [...(formData.bank_details || [{ account_number: '', ifsc_code: '', bank_name: '' }])];
              if (newBanks.length === 0) newBanks.push({ account_number: '', ifsc_code: '', bank_name: '' });
              newBanks[0].bank_name = e.target.value;
              setFormData({...formData, bank_details: newBanks});
            }}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
        <button 
          type="button"
          onClick={onCancel}
          className="px-6 py-3.5 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit"
          className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
        >
          {initialData ? 'Update Supplier' : 'Create Supplier'}
        </button>
      </div>
    </form>
  );
};

export default SupplierForm;
