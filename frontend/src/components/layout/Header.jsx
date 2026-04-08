import React from 'react';
import { Menu, X, ChevronRight } from 'lucide-react';

const Header = ({ 
  sidebarOpen, 
  setSidebarOpen, 
  activeTab, 
  currentUser 
}) => {
  return (
    <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-10 z-20 sticky top-0">
      <div className="flex items-center space-x-6">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-3 hover:bg-gray-50 rounded-2xl text-gray-400 transition-colors shadow-sm bg-white border border-gray-100">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="h-8 w-px bg-gray-100"></div>
        <div className="flex items-center space-x-2 text-sm font-bold text-gray-400">
          <span>Omniflow</span>
          <ChevronRight size={14} />
          <span className="text-gray-900 capitalize">{activeTab}</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="hidden md:flex flex-col text-right">
          <span className="text-sm font-black text-gray-900">{currentUser?.username || 'Loading...'}</span>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{currentUser?.role || 'Staff'} Access</span>
        </div>
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl shadow-lg shadow-blue-200 border-2 border-white flex items-center justify-center text-white font-black text-lg">
          {(currentUser?.username || 'U')[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default Header;
