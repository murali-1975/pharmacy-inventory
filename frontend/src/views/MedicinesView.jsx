import React, { useState } from 'react';
import { Search, Plus, Package, Edit, Trash2, Tag, Hash, Thermometer, ShieldCheck } from 'lucide-react';

const MedicinesView = ({ 
  medicines, 
  onAddClick, 
  onEditClick, 
  onDeleteClick,
  currentUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = medicines.filter(m => 
    (m.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.generic_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.hsn_code || '').includes(searchTerm)
  );

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicine Master</h1>
          <p className="text-gray-500">Central directory of pharmaceutical products</p>
        </div>
        {canManage && (
          <button 
            onClick={onAddClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>Add to Master</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by brand, generic name or HSN..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product Info</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manufacturer</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category & GST</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Storage & UOM</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{m.product_name}</p>
                      <div className="flex items-center text-xs text-gray-500 font-medium">
                        <ShieldCheck size={12} className="mr-1" />
                        {m.generic_name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center text-sm text-gray-700 font-bold">
                    <ShieldCheck size={14} className="mr-1.5 text-blue-500" />
                    {m.manufacturer?.name || 'Unknown'}
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="space-y-1.5">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700">
                      {m.category}
                    </span>
                    <div className="flex items-center text-xs text-gray-500 font-bold">
                      <Hash size={12} className="mr-1" />
                      HSN: {m.hsn_code}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="space-y-1.5 text-[11px] font-bold uppercase tracking-tight">
                    <div className="flex items-center text-blue-600">
                      <Thermometer size={12} className="mr-1" />
                      {m.storage_type}
                    </div>
                    <div className="flex items-center text-gray-500">
                      <Tag size={12} className="mr-1" />
                      Per {m.uom}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-right font-black text-blue-600">
                  ₹{m.unit_price?.toFixed(2) || '0.00'}
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {canManage && (
                      <>
                        <button 
                          onClick={() => onEditClick(m)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => onDeleteClick(m.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicinesView;
