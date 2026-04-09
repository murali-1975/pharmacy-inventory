import React, { useState } from 'react';
import { Search, Plus, Tag, Trash2, Edit2, AlertCircle } from 'lucide-react';

const SupplierTypesView = ({ 
  types, 
  onSave, 
  onDelete 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const filteredTypes = (types || []).filter(t => 
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditStart = (type) => {
    setIsEditing(type.id);
    setEditValue(type.name);
    setError('');
  };

  const handleSave = (id) => {
    if (!editValue.trim()) {
        setError('Please enter a type name');
        return;
    }
    
    // Check for duplicates
    if (types.some(t => t.name.toLowerCase() === editValue.trim().toLowerCase() && t.id !== id)) {
        setError('This type already exists');
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
          <h2 className="text-xl font-bold text-gray-900">Supplier Types</h2>
          <p className="text-sm text-gray-500">Manage categories for categorized supplier records</p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <div className="flex space-x-2">
                <input 
                    type="text" 
                    placeholder="New type name..."
                    className={`bg-white border rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium ${
                        error && isEditing === 'new' ? 'border-red-500' : 'border-gray-100'
                    }`}
                    value={isEditing === 'new' ? editValue : ''}
                    onChange={(e) => {
                        setIsEditing('new');
                        setEditValue(e.target.value);
                        setError('');
                    }}
                />
                <button 
                    onClick={() => handleSave(null)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center space-x-2"
                >
                    <Plus size={18} />
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

      {/* List Container */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-50 bg-gray-50/30">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search supplier types..."
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
            {filteredTypes.map(type => (
              <tr key={type.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-4 font-mono text-xs text-gray-400">#{type.id}</td>
                <td className="px-6 py-4">
                  {isEditing === type.id ? (
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
                                autoFocus
                            />
                            <button onClick={() => handleSave(type.id)} className="text-sm text-blue-600 font-bold hover:text-blue-700">Save</button>
                            <button onClick={() => { setIsEditing(null); setError(''); }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                        {error && (
                            <p className="text-[10px] text-red-500 font-bold">{error}</p>
                        )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 text-gray-400 rounded-lg">
                        <Tag size={16} />
                      </div>
                      <span className={`font-bold ${type.is_active === false ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {type.name}
                      </span>
                      {type.is_active === false && (
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
                      onClick={() => handleEditStart(type)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      aria-label="edit-type"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(type.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="delete-type"
                    >
                      <Trash2 size={16} />
                    </button>
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

export default SupplierTypesView;
