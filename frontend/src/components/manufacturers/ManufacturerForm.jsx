import React, { useState } from 'react';
import { Building2, MapPin, User, Phone } from 'lucide-react';

const ManufacturerForm = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    address: '',
    contact_person: '',
    phone_number: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Manufacturer Name</label>
        <div className="relative group">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            required
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Cipla Ltd."
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">Address</label>
        <div className="relative group">
          <MapPin className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <textarea 
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all min-h-[100px]"
            value={formData.address || ''}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="Detailed manufacturing address..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Contact Person</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.contact_person || ''}
              onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
              placeholder="John Doe"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Phone Number</label>
          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.phone_number || ''}
              onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
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
          {initialData ? 'Update Manufacturer' : 'Add Manufacturer'}
        </button>
      </div>
    </form>
  );
};

export default ManufacturerForm;
