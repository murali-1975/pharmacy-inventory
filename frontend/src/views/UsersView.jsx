import React, { useState } from 'react';
import { Search, Plus, User, Shield, CheckCircle2, XCircle } from 'lucide-react';

const UsersView = ({ 
  users, 
  onAddClick, 
  onEditClick, 
  onDeleteClick 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage application access and roles</p>
        </div>
        <button 
          onClick={onAddClick}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center space-x-2"
        >
          <Plus size={20} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search users by name or email..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <span className={`flex items-center w-fit px-3 py-1 rounded-lg text-xs font-bold ${
                    user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 
                    user.role === 'Manager' ? 'bg-blue-100 text-blue-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <Shield size={14} className="mr-1.5" />
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-6">
                  <span className={`flex items-center space-x-1.5 font-bold text-sm ${
                    user.is_active ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {user.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </span>
                </td>
                <td className="px-6 py-6 text-right">
                  <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEditClick(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => onDeleteClick(user.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Delete
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

export default UsersView;
