import React from 'react';
import { X } from 'lucide-react';

export const SidebarItem = ({ icon: Icon, label, active = false, onClick, isOpen = true }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
        : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
    } ${!isOpen ? 'justify-center space-x-0' : ''}`}
  >
    <Icon size={20} className={!isOpen ? 'shrink-0' : ''} />
    {isOpen && <span className="font-medium whitespace-nowrap overflow-hidden">{label}</span>}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, trend, color, subValue }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-blue-600`}>
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          trend > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{label}</h3>
    <div className="flex items-baseline space-x-2 mt-1">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subValue && <span className="text-xs text-gray-400 font-medium">{subValue}</span>}
    </div>
  </div>
);

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" data-testid="modal-overlay">
      <div className={`bg-white rounded-3xl w-full ${maxWidth} shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
