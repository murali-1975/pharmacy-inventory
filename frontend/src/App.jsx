import React, { useState, useEffect } from 'react';
import { LogOut, Menu, X, Settings, LayoutDashboard, Package, ChevronRight } from 'lucide-react';

// Core Components
import { SidebarItem, Modal } from './components/common/Common';
import DashboardHome from './views/DashboardHome';
import SupplierForm from './components/suppliers/SupplierForm';
import UserForm from './components/users/UserForm';
import InvoiceForm from './components/invoices/InvoiceForm';
import SuppliersView from './views/SuppliersView';
import InvoicesView from './views/InvoicesView';
import Login from './components/Login';
import AdminView from './views/AdminView';
import ManufacturerForm from './components/manufacturers/ManufacturerForm';
import MedicineForm from './components/medicines/MedicineForm';

// API & Hooks
import { useAuth } from './hooks/useAuth';
import { useSuppliers } from './hooks/useSuppliers';
import { useLookups } from './hooks/useLookups';
import { useUsers } from './hooks/useUsers';
import { useInvoices } from './hooks/useInvoices';
import { useMedicines } from './hooks/useMedicines';
import { useManufacturers } from './hooks/useManufacturers';

// Assets
import omniflowLogo from './assets/omniflow_logo.png';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'supplier', 'user', 'invoice', 'manufacturer', 'medicine'
  const [editingItem, setEditingItem] = useState(null);

  // Hooks
  const { token, currentUser, authError, login, logout, fetchMe } = useAuth();
  const { 
    suppliers, 
    loading: supLoading, 
    fetchSuppliers, 
    saveSupplier: onSaveSupplier, 
    deleteSupplier: onDeleteSupplier 
  } = useSuppliers(token, logout);
  
  const { 
    types, 
    statuses, 
    fetchLookups, 
    handleSaveType, 
    handleDeleteType, 
    handleSaveStatus, 
    handleDeleteStatus 
  } = useLookups(token, logout);
  
  const { 
    users, 
    fetchUsers, 
    handleSaveUser, 
    handleDeleteUser 
  } = useUsers(token, logout);

  const {
    invoices,
    loading: invLoading,
    fetchInvoices,
    saveInvoice: onSaveInvoice,
    deleteInvoice: onDeleteInvoice,
    currentPage,
    totalInvoices,
    pageSize,
    changePage
  } = useInvoices(token, logout);

  const {
    medicines,
    fetchMedicines,
    saveMedicine: onSaveMedicine,
    deleteMedicine: onDeleteMedicine
  } = useMedicines(token, logout);

  const {
    manufacturers,
    fetchManufacturers,
    saveManufacturer: onSaveManufacturer,
    deleteManufacturer: onDeleteManufacturer
  } = useManufacturers(token, logout);

  // Initial Data Fetch
  useEffect(() => {
    if (token) {
      fetchMe();
      fetchSuppliers();
      fetchLookups();
      fetchInvoices();
      fetchMedicines();
      fetchManufacturers();
    }
  }, [token, fetchMe, fetchSuppliers, fetchLookups, fetchInvoices, fetchMedicines, fetchManufacturers]);

  // Admin Data Fetch
  useEffect(() => {
    if (token && currentUser?.role === 'Admin') {
      fetchUsers();
    }
  }, [token, currentUser, fetchUsers]);

  const handleEditSupplier = (supplier) => {
    setEditingItem(supplier);
    setModalType('supplier');
    setIsModalOpen(true);
  };

  const handleEditUser = (user) => {
    setEditingItem(user);
    setModalType('user');
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (data) => {
    const success = await onSaveSupplier(data, editingItem?.id);
    if (success) {
      setIsModalOpen(false);
      setEditingItem(null);
    }
  };

  const handleSaveUserInternal = async (data) => {
    const success = await handleSaveUser(data, editingItem?.id);
    if (success) {
      setIsModalOpen(false);
      setEditingItem(null);
    }
  };

  if (!token) {
    return <Login onLogin={login} error={authError} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden text-sm">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-100 flex flex-col transition-all duration-500 ease-in-out z-30 shadow-2xl shadow-gray-200/50`}>
        <div className="p-8 flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200 shrink-0 transform hover:rotate-12 transition-transform cursor-pointer">
            <img src={omniflowLogo} alt="Omniflow Logo" className="w-8 h-8 object-contain brightness-0 invert" />
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
            icon={LayoutDashboard} // Replace with FileText if available, using LayoutDashboard as placeholder
            label="Invoices" 
            active={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')} 
            isOpen={sidebarOpen}
          />
          
          {currentUser?.role === 'Admin' && (
            <div className="pt-8 pb-2">
              {sidebarOpen && <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Administration</p>}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
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

        <section className="flex-1 overflow-y-auto p-10 bg-[#f9fafc]">
          {activeTab === 'dashboard' && <DashboardHome setView={setActiveTab} invoices={invoices} />}
          {activeTab === 'suppliers' && (
            <SuppliersView 
              suppliers={suppliers} 
              onAddClick={() => { setEditingItem(null); setModalType('supplier'); setIsModalOpen(true); }}
              onEditClick={handleEditSupplier}
              onDeleteClick={onDeleteSupplier}
              types={types}
              statuses={statuses}
              loading={supLoading}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoicesView 
              invoices={invoices}
              onAddClick={() => { setEditingItem(null); setModalType('invoice'); setIsModalOpen(true); }}
              onEditClick={(inv) => { setEditingItem(inv); setModalType('invoice'); setIsModalOpen(true); }}
              onDeleteClick={onDeleteInvoice}
              loading={invLoading}
              currentUser={currentUser}
              currentPage={currentPage}
              totalInvoices={totalInvoices}
              pageSize={pageSize}
              onChangePage={changePage}
            />
          )}
          {activeTab === 'admin' && currentUser?.role === 'Admin' && (
            <AdminView 
              users={users}
              onAddUser={() => { setEditingItem(null); setModalType('user'); setIsModalOpen(true); }}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              supplierTypes={types}
              onSaveType={handleSaveType}
              onDeleteType={handleDeleteType}
              statuses={statuses}
              onSaveStatus={handleSaveStatus}
              onDeleteStatus={handleDeleteStatus}
              manufacturers={manufacturers}
              onAddManufacturer={() => { setEditingItem(null); setModalType('manufacturer'); setIsModalOpen(true); }}
              onEditManufacturer={(m) => { setEditingItem(m); setModalType('manufacturer'); setIsModalOpen(true); }}
              onDeleteManufacturer={onDeleteManufacturer}
              medicines={medicines}
              onAddMedicineMaster={() => { setEditingItem(null); setModalType('medicine'); setIsModalOpen(true); }}
              onEditMedicineMaster={(m) => { setEditingItem(m); setModalType('medicine'); setIsModalOpen(true); }}
              onDeleteMedicineMaster={onDeleteMedicine}
              currentUser={currentUser}
            />
          )}
        </section>


      </main>

      {/* Modal Overlay */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        title={
          modalType === 'supplier' ? (editingItem ? 'Edit Supplier' : 'New Supplier') :
          modalType === 'invoice' ? (editingItem ? 'Edit Invoice' : 'New Purchase Invoice') :
          modalType === 'manufacturer' ? (editingItem ? 'Edit Manufacturer' : 'New Manufacturer') :
          modalType === 'medicine' ? (editingItem ? 'Edit Medicine Master' : 'Add to Medicine Master') :
          (editingItem ? 'Edit User' : 'New User')
        }
      >
        {modalType === 'supplier' ? (
          <SupplierForm 
            onSave={handleSaveSupplier}
            initialData={editingItem}
            types={types}
            statuses={statuses}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        ) : modalType === 'invoice' ? (
          <InvoiceForm 
            onSave={async (data) => {
              const success = await onSaveInvoice(data, editingItem?.id);
              if (success) { setIsModalOpen(false); setEditingItem(null); }
            }}
            initialData={editingItem}
            suppliers={suppliers}
            medicines={medicines}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        ) : modalType === 'manufacturer' ? (
          <ManufacturerForm 
            onSave={async (data) => {
              const success = await onSaveManufacturer(data, editingItem?.id);
              if (success) { setIsModalOpen(false); setEditingItem(null); }
            }}
            initialData={editingItem}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        ) : modalType === 'medicine' ? (
          <MedicineForm 
            onSave={async (data) => {
              const success = await onSaveMedicine(data, editingItem?.id);
              if (success) { setIsModalOpen(false); setEditingItem(null); }
            }}
            manufacturers={manufacturers}
            initialData={editingItem}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        ) : (
          <UserForm 
            onSave={handleSaveUserInternal}
            initialData={editingItem}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        )}
      </Modal>
    </div>
  );
};

export default App;
