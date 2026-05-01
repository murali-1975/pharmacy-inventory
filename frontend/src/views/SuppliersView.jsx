import React, { useState } from 'react';
import { Search, Plus, Building2, User, Mail, Database, X, Edit, Trash2 } from 'lucide-react';

/**
 * Component for viewing and managing suppliers.
 * 
 * @param {Object} props - Component properties.
 * @param {Array} props.suppliers - List of suppliers to display.
 * @param {Array} props.statuses - List of available statuses (for filtering/display).
 * @param {Array} props.types - List of supplier types.
 * @param {function} props.onAddClick - Callback to open the add supplier modal.
 * @param {function} props.onEditClick - Callback to open the edit supplier modal.
 * @param {function} props.onDeleteClick - Callback to delete a supplier.
 * @param {Object} props.currentUser - The currently logged-in user.
 */
const SuppliersView = ({ 
  suppliers, 
  onAddClick, 
  onEditClick, 
  onDeleteClick,
  currentUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSuppliers = suppliers.filter(s => 
    (s.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.type?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Directory</h1>
          <p className="text-gray-500">Manage your verified vendor network</p>
        </div>
        {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'Staff') && (
          <button 
            onClick={onAddClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search suppliers by name or type..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Details</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSuppliers.map(supplier => (
                <tr key={supplier.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-2.5 bg-gray-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 leading-tight">{supplier.supplier_name}</div>
                        <div className="text-[11px] text-gray-400 font-medium uppercase tracking-tight mt-0.5">ID: SUP-{supplier.id.toString().padStart(4, '0')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {supplier.type?.name || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600 font-medium tracking-tight">
                        <User size={14} className="mr-2 text-gray-400 shrink-0" />
                        {supplier.contact_details?.contact_name || '—'}
                      </div>
                      <div className="flex items-center text-[13px] text-gray-500 font-normal">
                        <Mail size={14} className="mr-2 text-gray-300 shrink-0" />
                        {supplier.contact_details?.email_id || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${
                      supplier.status?.name === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {supplier.status?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'Staff') && (
                        <button 
                          onClick={() => onEditClick(supplier)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit Details"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      {currentUser?.role === 'Admin' && (
                        <button 
                          onClick={() => onDeleteClick(supplier.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Deactivate"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium">
                    No suppliers found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuppliersView;
