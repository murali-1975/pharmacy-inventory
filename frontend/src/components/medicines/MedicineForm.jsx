import React, { useState } from 'react';
import { Package, Hash, Building2, Tag, Box, Thermometer, ShieldCheck } from 'lucide-react';

const MedicineForm = ({ initialData, manufacturers, onSave, onCancel }) => {
  const [formData, setFormData] = useState(initialData || {
    product_name: '',
    generic_name: '',
    manufacturer_id: '',
    hsn_code: '',
    category: 'General',
    uom: 'Strip',
    storage_type: 'Ambient',
    description: '',
    unit_price: 0
  });

  const categories = ["Scheduled H", "Scheduled H1", "Scheduled X", "OTC", "General"];
  const uoms = ["Strip", "Bottle", "Vial", "Each"];
  const storageTypes = ["Ambient", "Cold Chain (2-8°C)", "Controlled"];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Product Name (Brand)</label>
          <div className="relative group">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.product_name || ''}
              onChange={(e) => setFormData({...formData, product_name: e.target.value})}
              placeholder="e.g. Crocin 650"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Generic Name (Salt)</label>
          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.generic_name || ''}
              onChange={(e) => setFormData({...formData, generic_name: e.target.value})}
              placeholder="e.g. Paracetamol"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Manufacturer</label>
          <div className="relative group">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <select 
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
              value={formData.manufacturer_id || ''}
              onChange={(e) => setFormData({...formData, manufacturer_id: parseInt(e.target.value)})}
            >
              <option value="">Select Manufacturer</option>
              {manufacturers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">HSN Code</label>
          <div className="relative group">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              required
              maxLength={8}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.hsn_code || ''}
              onChange={(e) => setFormData({...formData, hsn_code: e.target.value})}
              placeholder="8-digit code"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Category</label>
          <div className="relative group">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <select 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Unit of Measure</label>
          <div className="relative group">
            <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <select 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
              value={formData.uom}
              onChange={(e) => setFormData({...formData, uom: e.target.value})}
            >
              {uoms.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Storage Type</label>
          <div className="relative group">
            <Thermometer className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <select 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
              value={formData.storage_type}
              onChange={(e) => setFormData({...formData, storage_type: e.target.value})}
            >
              {storageTypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Unit Price (₹)</label>
          <div className="relative group">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="number"
              step="0.01"
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.unit_price || 0}
              onChange={(e) => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">Description / Notes</label>
          <div className="relative group">
            <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Brief description or usage notes"
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
          {initialData ? 'Update Medicine' : 'Add to Master'}
        </button>
      </div>
    </form>
  );
};

export default MedicineForm;
