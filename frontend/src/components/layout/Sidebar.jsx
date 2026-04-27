import React, { useState } from 'react';
import { LogOut, LayoutDashboard, Package, Settings, X, Menu, DollarSign, TrendingUp, History, Plus, Database, FileText, Wallet, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { SidebarItem } from '../common/Common';
import { Feature } from '../../context/FeatureContext';

const Sidebar = ({ 
  sidebarOpen, 
  setSidebarOpen, 
  activeTab, 
  setActiveTab, 
  currentUser, 
  logout, 
  logo 
}) => {
  const [financeExpanded, setFinanceExpanded] = useState(true);
  const [inventoryExpanded, setInventoryExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(true);

  // Helpers to check if any tab in a group is active
  const isFinanceActive = activeTab.startsWith('finance') && activeTab !== 'finance-masters';
  const isInventoryActive = ['dashboard', 'suppliers', 'invoices', 'dispensing', 'stock'].includes(activeTab);
  const isAdminActive = ['financials', 'admin', 'finance-masters'].includes(activeTab);
  return (
    <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-100 flex flex-col transition-all duration-500 ease-in-out z-30 shadow-2xl shadow-gray-200/50`}>
      <div className="p-8 flex items-center space-x-4">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-100/50 shrink-0 transform hover:rotate-12 transition-transform cursor-pointer border border-gray-100 p-2">
          <img src={logo} alt="Omniflow Logo" className="w-10 h-10 object-contain" />
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 leading-none">Omniflow</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1 opacity-60">Practice Management</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
        {/* Inventory Section */}
        <div className="pt-2 pb-2">
          <div 
            onClick={() => sidebarOpen && setInventoryExpanded(!inventoryExpanded)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
              isInventoryActive && !inventoryExpanded
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-500 hover:bg-gray-50'
            } ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <div className="flex items-center space-x-3">
              <Package size={20} className={!sidebarOpen ? 'shrink-0' : ''} />
              {sidebarOpen && <span className="font-bold text-sm tracking-tight uppercase">Inventory</span>}
            </div>
            {sidebarOpen && (
              inventoryExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
            )}
          </div>

          {sidebarOpen && inventoryExpanded && (
            <div className="mt-2 ml-4 space-y-1 border-l-2 border-gray-50 pl-2 animate-in slide-in-from-top-2 duration-300">
              {/* Overview Group */}
              <div className="pt-2 pb-1 px-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Overview</p>
              </div>
              <SidebarItem 
                icon={LayoutDashboard} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
                isOpen={sidebarOpen}
              />

              {/* Operations Group */}
              <div className="pt-2 pb-1 px-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Operations</p>
              </div>
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

              {/* Supply Chain Group */}
              <div className="pt-2 pb-1 px-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Supply Chain</p>
              </div>
              <SidebarItem 
                icon={LayoutDashboard} 
                label="Invoices" 
                active={activeTab === 'invoices'} 
                onClick={() => setActiveTab('invoices')} 
                isOpen={sidebarOpen}
              />
              <SidebarItem 
                icon={Package} 
                label="Suppliers" 
                active={activeTab === 'suppliers'} 
                onClick={() => setActiveTab('suppliers')} 
                isOpen={sidebarOpen}
              />
            </div>
          )}
          
          {!sidebarOpen && isInventoryActive && (
             <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mx-auto mt-1" />
          )}
        </div>
        
        <Feature name="FINANCE_MANAGEMENT">
          <div className="pt-4 pb-2">
            <div 
              onClick={() => sidebarOpen && setFinanceExpanded(!financeExpanded)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                isFinanceActive && !financeExpanded
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-50'
              } ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className="flex items-center space-x-3">
                <DollarSign size={20} className={!sidebarOpen ? 'shrink-0' : ''} />
                {sidebarOpen && <span className="font-bold text-sm tracking-tight uppercase">Finance</span>}
              </div>
              {sidebarOpen && (
                financeExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
              )}
            </div>

            {sidebarOpen && financeExpanded && (
              <div className="mt-2 ml-4 space-y-1 border-l-2 border-gray-50 pl-2 animate-in slide-in-from-top-2 duration-300">
                {/* Overview Group - Visible to Admin and Staff */}
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Staff') && (
                  <>
                    <SidebarItem 
                      icon={TrendingUp} 
                      label="Finance Dashboard" 
                      active={activeTab === 'finance-dashboard'} 
                      onClick={() => setActiveTab('finance-dashboard')} 
                      isOpen={sidebarOpen}
                    />
                    <SidebarItem 
                      icon={FileText} 
                      label="Daily Summaries" 
                      active={activeTab === 'finance-summary'} 
                      onClick={() => setActiveTab('finance-summary')} 
                      isOpen={sidebarOpen}
                    />
                  </>
                )}

                {/* Sensitive Financial Data - Admin Only */}
                {currentUser?.role === 'Admin' && (
                  <SidebarItem 
                    icon={BookOpen} 
                    label="Financial Ledger" 
                    active={activeTab === 'finance-ledger'} 
                    onClick={() => setActiveTab('finance-ledger')} 
                    isOpen={sidebarOpen}
                  />
                )}

                {/* Payments Group */}
                <div className="pt-2 pb-1 px-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Payments</p>
                </div>
                <SidebarItem 
                  icon={Plus} 
                  label="Record Payment" 
                  active={activeTab === 'finance-record'} 
                  onClick={() => setActiveTab('finance-record')} 
                  isOpen={sidebarOpen}
                />
                <SidebarItem 
                  icon={History} 
                  label="Payment History" 
                  active={activeTab === 'finance-history'} 
                  onClick={() => setActiveTab('finance-history')} 
                  isOpen={sidebarOpen}
                />

                {/* Expenses Group */}
                <div className="pt-2 pb-1 px-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Expenses</p>
                </div>
                <SidebarItem 
                  icon={Wallet} 
                  label="Record Expense" 
                  active={activeTab === 'finance-expenses'} 
                  onClick={() => setActiveTab('finance-expenses')} 
                  isOpen={sidebarOpen}
                />
                <SidebarItem 
                  icon={History} 
                  label="Expense History" 
                  active={activeTab === 'finance-expenses-history'} 
                  onClick={() => setActiveTab('finance-expenses-history')} 
                  isOpen={sidebarOpen}
                />
              </div>
            )}
            
            {!sidebarOpen && isFinanceActive && (
               <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mx-auto mt-1" />
            )}
          </div>
        </Feature>
        
        {currentUser?.role === 'Admin' && (
          <div className="pt-4 pb-2 border-t border-gray-50 mt-4">
            <div 
              onClick={() => sidebarOpen && setAdminExpanded(!adminExpanded)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                isAdminActive && !adminExpanded
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-50'
              } ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className="flex items-center space-x-3">
                <Settings size={20} className={!sidebarOpen ? 'shrink-0' : ''} />
                {sidebarOpen && <span className="font-bold text-sm tracking-tight uppercase">Administration</span>}
              </div>
              {sidebarOpen && (
                adminExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
              )}
            </div>

            {sidebarOpen && adminExpanded && (
              <div className="mt-2 ml-4 space-y-1 border-l-2 border-gray-50 pl-2 animate-in slide-in-from-top-2 duration-300">
                {/* Reports Group */}
                <div className="pt-2 pb-1 px-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Reports</p>
                </div>
                <SidebarItem 
                  icon={DollarSign} 
                  label="Financial Reports" 
                  active={activeTab === 'financials'} 
                  onClick={() => setActiveTab('financials')} 
                  isOpen={sidebarOpen}
                />

                {/* Finance Setup Group */}
                <Feature name="FINANCE_MANAGEMENT">
                  <div className="pt-2 pb-1 px-4">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Finance Setup</p>
                  </div>
                  <SidebarItem 
                    icon={Database} 
                    label="Master Data" 
                    active={activeTab === 'finance-masters'} 
                    onClick={() => setActiveTab('finance-masters')} 
                    isOpen={sidebarOpen}
                  />
                </Feature>

                {/* System Group */}
                <div className="pt-2 pb-1 px-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">System</p>
                </div>
                <SidebarItem 
                  icon={Settings} 
                  label="Admin Hub" 
                  active={activeTab === 'admin'} 
                  onClick={() => setActiveTab('admin')} 
                  isOpen={sidebarOpen}
                />
              </div>
            )}
            
            {!sidebarOpen && isAdminActive && (
               <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mx-auto mt-1" />
            )}
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
