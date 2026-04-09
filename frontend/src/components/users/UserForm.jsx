import React, { useState } from 'react';
import { User, Mail, Shield, Lock, CheckCircle2 } from 'lucide-react';

const UserForm = ({ 
  initialData, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState(initialData || {
    username: '',
    email: '',
    role: 'Staff',
    password: '',
    is_active: true
  });

  const isEdit = !!initialData;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="user-username" className="text-sm font-bold text-gray-700">Username</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              id="user-username"
              required
              disabled={isEdit}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all disabled:opacity-50"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="johndoe"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="user-email" className="text-sm font-bold text-gray-700">Email Address</label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              id="user-email"
              required
              type="email"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="john@example.com"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="user-role" className="text-sm font-bold text-gray-700">Role</label>
          <div className="relative group">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <select 
              id="user-role"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Administrator</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="user-password" className="text-sm font-bold text-gray-700">{isEdit ? 'New Password (optional)' : 'Password'}</label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              id="user-password"
              required={!isEdit}
              type="password"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={formData.password || ''}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 group cursor-pointer" onClick={() => setFormData({...formData, is_active: !formData.is_active})}>
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${formData.is_active ? 'bg-blue-600 border-blue-600' : 'border-gray-200 bg-white'}`}>
          {formData.is_active && <CheckCircle2 size={16} className="text-white" />}
        </div>
        <span className="text-sm font-bold text-blue-900">User is active and allowed to login</span>
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
          {isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
