import React from 'react';
import { LogOut, LayoutDashboard, Package, Settings, X, Menu, DollarSign } from 'lucide-react';
import { SidebarItem } from '../common/Common';

const Sidebar = ({ 
  sidebarOpen, 
  setSidebarOpen, 
  activeTab, 
  setActiveTab, 
  currentUser, 
  logout, 
  logo 
}) => {
  return (
    <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-100 flex flex-col transition-all duration-500 ease-in-out z-30 shadow-2xl shadow-gray-200/50`}>
      <div className="p-8 flex items-center space-x-4">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-100/50 shrink-0 transform hover:rotate-12 transition-transform cursor-pointer border border-gray-100 p-2">
          <img src={logo} alt="Omniflow Logo" className="w-10 h-10 object-contain" />
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 leading-none">Omniflow</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1 opacity-60">Inventory Systems</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
        <SidebarItem 
          icon={LayoutDashboard} 
          label="Dashboard" 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          isOpen={sidebarOpen}
        />
        <SidebarItem 
          icon={Package} 
          label="Suppliers" 
          active={activeTab === 'suppliers'} 
          onClick={() => setActiveTab('suppliers')} 
          isOpen={sidebarOpen}
        />
        <SidebarItem 
          icon={LayoutDashboard} 
          label="Invoices" 
          active={activeTab === 'invoices'} 
          onClick={() => setActiveTab('invoices')} 
          isOpen={sidebarOpen}
        />
        <SidebarItem 
          icon={Package}
          label="Dispensing" 
          active={activeTab === 'dispensing'} 
          onClick={() => setActiveTab('dispensing')} 
          isOpen={sidebarOpen}
        />
        <SidebarItem 
          icon={Settings}
          label="Stock Inventory" 
          active={activeTab === 'stock'} 
          onClick={() => setActiveTab('stock')} 
          isOpen={sidebarOpen}
        />
        
        {currentUser?.role === 'Admin' && (
          <div className="pt-8 pb-2">
            {sidebarOpen && <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Administration</p>}
            <SidebarItem 
              icon={DollarSign} 
              label="Financial Reports" 
              active={activeTab === 'financials'} 
              onClick={() => setActiveTab('financials')} 
              isOpen={sidebarOpen}
            />
            <SidebarItem 
              icon={Settings} 
              label="Admin Hub" 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              isOpen={sidebarOpen}
            />
          </div>
        )}
      </nav>

      <div className="p-6 border-t border-gray-50">
        <button onClick={logout} className="w-full flex items-center space-x-3 p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 group font-bold">
          <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
