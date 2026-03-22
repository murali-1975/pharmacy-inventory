import React, { useState } from 'react';
import { Search, Plus, Building2, Phone, MapPin, User, Edit, Trash2 } from 'lucide-react';

const ManufacturersView = ({ 
  manufacturers, 
  onAddClick, 
  onEditClick, 
  onDeleteClick,
  currentUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = manufacturers.filter(m => 
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manufacturers</h1>
          <p className="text-gray-500">Manage drug manufacturers and brands</p>
        </div>
        {canManage && (
          <button 
            onClick={onAddClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Manufacturer</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search manufacturers..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manufacturer</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{m.name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${m.is_active ? 'text-green-500' : 'text-red-400'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-gray-900 font-medium">
                      <User size={14} className="mr-2 text-gray-400" />
                      {m.contact_person || 'N/A'}
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Phone size={14} className="mr-2 text-gray-400" />
                      {m.phone_number || 'N/A'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-start text-sm text-gray-600 max-w-[250px]">
                    <MapPin size={14} className="mr-2 mt-1 text-gray-400 shrink-0" />
                    <span className="line-clamp-2">{m.address || 'No address provided'}</span>
                  </div>
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

export default ManufacturersView;
