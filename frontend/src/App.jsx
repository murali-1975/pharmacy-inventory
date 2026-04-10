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
import DispensingView from './views/DispensingView';
import ManufacturerForm from './components/manufacturers/ManufacturerForm';
import MedicineForm from './components/medicines/MedicineForm';
import StockView from './views/StockView';
import FinancialsView from './views/FinancialsView';


// Layout Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

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
  const { token, currentUser, authError, logoutReason, login, logout, fetchMe } = useAuth();
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
    changePage,
    saveInvoicePayment,
    handleSearch,
    searchTerm,
    sortBy,
    sortOrder,
    handleSort
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

  // Auth and Lookups Fetch
  useEffect(() => {
    if (token) {
      fetchMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchLookups(currentUser?.role === 'Admin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.role]);

  // General Master Data Fetch
  useEffect(() => {
    if (token) {
      fetchSuppliers();
      fetchMedicines();
      fetchManufacturers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Invoices Fetch
  useEffect(() => {
    if (token) {
      fetchInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Admin Data Fetch
  useEffect(() => {
    if (token && currentUser?.role === 'Admin') {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.role]);

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

  // Filtered lookups for regular use (dropdowns, selectors)
  const activeTypes = types.filter(t => t.is_active || t.id === editingItem?.type_id);
  const activeStatuses = statuses.filter(s => s.is_active || s.id === editingItem?.status_id);

  if (!token) {
    return <Login onLogin={login} error={authError} logoutReason={logoutReason} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden text-sm">
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        logout={logout}
        logo={omniflowLogo}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeTab={activeTab}
          currentUser={currentUser}
        />

        <section className="flex-1 overflow-y-auto p-10 bg-[#f9fafc]">
          {activeTab === 'dashboard' && <DashboardHome setView={setActiveTab} invoices={invoices} token={token} onUnauthorized={logout} />}
          {activeTab === 'suppliers' && (
            <SuppliersView 
              suppliers={suppliers} 
              onAddClick={() => { setEditingItem(null); setModalType('supplier'); setIsModalOpen(true); }}
              onEditClick={handleEditSupplier}
              onDeleteClick={onDeleteSupplier}
              types={activeTypes}
              statuses={activeStatuses}
              loading={supLoading}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoicesView 
              invoices={invoices}
              onAddClick={() => { setEditingItem(null); setModalType('invoice'); setIsModalOpen(true); }}
              onEditClick={(inv) => { setEditingItem(inv); setModalType('invoice'); setIsModalOpen(true); }}
              onDeleteClick={async (id) => {
                await onDeleteInvoice(id);
                fetchMedicines();
              }}
              loading={invLoading}
              currentUser={currentUser}
              currentPage={currentPage}
              totalInvoices={totalInvoices}
              pageSize={pageSize}
              onChangePage={changePage}
              onRefresh={fetchInvoices}
              onSavePayment={saveInvoicePayment}
              onSearch={handleSearch}
              searchTerm={searchTerm}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              token={token}
            />
          )}
          {activeTab === 'dispensing' && (
            <DispensingView medicines={medicines} onRefreshMedicines={fetchMedicines} token={token} userRole={currentUser?.role} onUnauthorized={logout} />
          )}
          {activeTab === 'stock' && (
            <StockView medicinesList={medicines} onRefreshMedicines={fetchMedicines} token={token} userRole={currentUser?.role} onUnauthorized={logout} />
          )}
          {activeTab === 'financials' && currentUser?.role === 'Admin' && (
            <FinancialsView token={token} onUnauthorized={logout} />
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
              token={token}
            />
          )}
        </section>
      </main>

      {/* Modal Overlay */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        maxWidth={modalType === 'invoice' ? 'max-w-6xl' : 'max-w-2xl'}
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
            types={activeTypes}
            statuses={activeStatuses}
            onCancel={() => { setIsModalOpen(false); setEditingItem(null); }}
          />
        ) : modalType === 'invoice' ? (
          <InvoiceForm 
            onSave={async (data) => {
              const success = await onSaveInvoice(data, editingItem?.id);
              if (success) { 
                fetchMedicines();
                setIsModalOpen(false); 
                setEditingItem(null); 
              }
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
