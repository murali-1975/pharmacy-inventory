import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Pill, 
  FileText, 
  Package, 
  Upload, 
  TrendingUp, 
  AlertCircle,
  Search,
  Settings,
  Bell,
  User,
  Plus,
  ArrowRight,
  Database,
  Building2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
        : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </div>
);

const StatCard = ({ icon: Icon, label, value, trend, color, subValue }) => (
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

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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

// --- Views ---

const DashboardHome = ({ setView }) => (
  <>
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard icon={Package} label="Total Medicines" value="248" trend={12} color="bg-blue-500" subValue="items" />
      <StatCard icon={Building2} label="Active Suppliers" value="16" trend={0} color="bg-indigo-500" subValue="vendors" />
      <StatCard icon={TrendingUp} label="Monthly Procurement" value="₹1,45,210" trend={8.2} color="bg-green-500" />
      <StatCard icon={AlertCircle} label="Low Stock Alert" value="24" trend={-2} color="bg-orange-500" />
    </div>

    {/* Recent Activities & Quick Actions */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">Recent Invoices</h2>
          <button 
            onClick={() => setView('Invoices')}
            className="text-blue-600 text-sm font-semibold hover:underline flex items-center"
          >
            View All <ArrowRight size={14} className="ml-1" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b border-gray-50">
                <th className="pb-4 font-semibold">Ref #</th>
                <th className="pb-4 font-semibold">Supplier</th>
                <th className="pb-4 font-semibold">Date</th>
                <th className="pb-4 font-semibold">Value</th>
                <th className="pb-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { ref: 'INV-152467812', supplier: 'AKG Enterprises', date: 'Mar 15, 2026', value: '₹12,450', status: 'Reconciled' },
                { ref: 'INV-173338102', supplier: 'Alpha Technologies', date: 'Mar 12, 2026', value: '₹8,200', status: 'Pending' },
                { ref: 'INV-152467795', supplier: 'Ambal Press', date: 'Mar 10, 2026', value: '₹4,100', status: 'Reconciled' },
              ].map((inv, i) => (
                <tr key={i} className="group hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                  <td className="py-4 font-mono text-xs">{inv.ref}</td>
                  <td className="py-4 font-medium">{inv.supplier}</td>
                  <td className="py-4 text-gray-600">{inv.date}</td>
                  <td className="py-4 font-bold text-gray-900">{inv.value}</td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                      inv.status === 'Reconciled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-200 flex flex-col justify-between">
        <div>
          <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/30">
            <Upload size={24} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Process Stock</h2>
          <p className="text-blue-100 text-sm leading-relaxed mb-8">
            Sync new arrivals. Upload digital invoices to auto-update batches and reconcile payments.
          </p>
        </div>
        <button 
          onClick={() => setView('Upload')}
          className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-lg active:scale-95 duration-200 flex items-center justify-center space-x-2"
        >
          <span>Start Upload</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  </>
);

const SuppliersView = ({ suppliers, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.supplier_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredSuppliers.slice(startIndex, startIndex + itemsPerPage);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold">Supplier Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your vendors and bank details</p>
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Search by name or type..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button 
            onClick={() => onEdit(null)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Supplier</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-50">
              <th className="pb-4 font-semibold px-4">Supplier Name</th>
              <th className="pb-4 font-semibold px-4">Type</th>
              <th className="pb-4 font-semibold px-4">Status</th>
              <th className="pb-4 font-semibold px-4">Bank Accounts</th>
              <th className="pb-4 font-semibold px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {currentData.map(s => (
              <tr key={s.id} className="group hover:bg-blue-50/30 transition-colors border-b border-gray-50 last:border-0">
                <td className="py-4 px-4">
                  <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                    {s.supplier_type}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${s.status === 'Active' ? 'bg-green-500 ring-4 ring-green-50' : 'bg-gray-300 ring-4 ring-gray-50'}`}></span>
                    <span className="font-medium text-gray-700">{s.status}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center text-gray-500">
                    <Database size={14} className="mr-2 text-blue-400" />
                    <span className="font-medium">{s.bank_details?.length || 0} Accounts</span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex justify-end space-x-1">
                    <button 
                      onClick={() => onEdit(s)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Edit Supplier"
                    >
                      <Settings size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(s.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Deactivate Supplier"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {currentData.length === 0 && (
              <tr>
                <td colSpan="5" className="py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Search className="text-gray-200 mb-2" size={48} />
                    <p className="text-gray-400 font-medium italic">No suppliers found matching your criteria</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-50">
          <p className="text-xs text-gray-500 font-medium">
            Showing <span className="text-gray-900 font-bold">{startIndex + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(startIndex + itemsPerPage, filteredSuppliers.length)}</span> of <span className="text-gray-900 font-bold">{filteredSuppliers.length}</span> suppliers
          </p>
          <div className="flex items-center space-x-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 border border-gray-200 rounded-xl disabled:opacity-30 hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center space-x-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-9 h-9 text-xs font-bold rounded-xl transition-all ${
                    currentPage === i + 1 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                      : 'hover:bg-blue-50 text-gray-500'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 border border-gray-200 rounded-xl disabled:opacity-30 hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SupplierForm = ({ supplier, onSave, onCancel }) => {
  const [formData, setFormData] = useState(supplier || {
    name: '',
    supplier_type: 'Pharmacy',
    status: 'Active',
    bank_details: []
  });

  const [bankRows, setBankRows] = useState(supplier?.bank_details || []);

  const addBankRow = () => setBankRows([...bankRows, { account_name: '', account_number: '', ifsc_code: '', bank_reference: '', remarks: '', status: 'Active' }]);
  const removeBankRow = (index) => setBankRows(bankRows.filter((_, i) => i !== index));

  const updateBankRow = (index, field, value) => {
    const newRows = [...bankRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setBankRows(newRows);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, bank_details: bankRows });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Supplier Name</label>
          <input 
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. HealthCorp Pharma"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Type</label>
          <select 
            value={formData.supplier_type}
            onChange={(e) => setFormData({...formData, supplier_type: e.target.value})}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option>Pharmacy</option>
            <option>Printer</option>
            <option>Lab</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Status</label>
          <select 
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      <div className="pt-4">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-xs font-bold text-gray-500 uppercase">Bank Accounts</label>
          <button type="button" onClick={addBankRow} className="text-blue-600 text-xs font-bold hover:underline flex items-center">
            <Plus size={14} className="mr-1" /> Add Account
          </button>
        </div>
        <div className="space-y-4">
          {bankRows.map((row, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
              <button 
                type="button"
                onClick={() => removeBankRow(i)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Account Name" 
                  value={row.account_name}
                  onChange={(e) => updateBankRow(i, 'account_name', e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                />
                <input 
                  placeholder="Account Number" 
                  value={row.account_number}
                  onChange={(e) => updateBankRow(i, 'account_number', e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none font-mono" 
                />
                <input 
                  placeholder="IFSC Code" 
                  value={row.ifsc_code}
                  onChange={(e) => updateBankRow(i, 'ifsc_code', e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                />
                <input 
                  placeholder="Bank Reference" 
                  value={row.bank_reference}
                  onChange={(e) => updateBankRow(i, 'bank_reference', e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                />
              </div>
            </div>
          ))}
          {bankRows.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-xs text-gray-400">No bank accounts added yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-3 pt-6 border-t border-gray-100">
        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">
          {supplier ? 'Update Supplier' : 'Create Supplier'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
};

// --- Main Application Shell ---

const InvoiceUploadForm = ({ onCancel }) => {
  const [lineItems, setLineItems] = useState([{ name: '', qty: '', price: '', disc: '', expiry: '' }]);

  const addRow = () => setLineItems([...lineItems, { name: '', qty: '', price: '', disc: '', expiry: '' }]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Supplier</label>
          <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none">
            <option>Select Supplier</option>
            <option>AKG Enterprises</option>
            <option>Alpha Technologies</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Reference #</label>
          <input type="text" placeholder="INV-0000" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Invoice Date</label>
          <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Total Value</label>
            <input type="number" placeholder="0.00" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">GST</label>
            <input type="number" placeholder="0.00" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <label className="block text-xs font-bold text-gray-500 uppercase">Line Items</label>
          <button onClick={addRow} className="text-blue-600 text-xs font-bold hover:underline flex items-center">
            <Plus size={14} className="mr-1" /> Add Medication
          </button>
        </div>
        <div className="space-y-2">
          {lineItems.map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input placeholder="Medicine Name" className="col-span-4 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              <input placeholder="Qty" type="number" className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              <input placeholder="Price" type="number" className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              <input placeholder="Disc %" type="number" className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="date" className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[10px] outline-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex space-x-3 pt-6 border-t border-gray-100">
        <button className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
          Save Invoice
        </button>
        <button onClick={onCancel} className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

// --- Main Application Shell ---

const App = () => {
  const [activeView, setActiveView] = useState('Dashboard');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  };

  const handleEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (supplierData) => {
    setIsLoading(true);
    try {
      const isEdit = !!supplierData.id;
      const url = isEdit 
        ? `http://127.0.0.1:8000/suppliers/${supplierData.id}` 
        : 'http://127.0.0.1:8000/suppliers';
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData),
      });

      if (response.ok) {
        await fetchSuppliers();
        setIsSupplierModalOpen(false);
        setEditingSupplier(null);
      } else {
        const err = await response.json();
        alert(`Error: ${err.detail || 'Save failed'}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Network error while saving supplier.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (window.confirm("Are you sure you want to deactivate this supplier? This will be a soft delete for auditing purposes.")) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/suppliers/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchSuppliers();
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'Dashboard': return <DashboardHome setView={setActiveView} />;
      case 'Suppliers': return <SuppliersView suppliers={suppliers} onEdit={handleEditSupplier} onDelete={handleDeleteSupplier} />;
      case 'Medicines': return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-6">Inventory List</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {['Paracetamol 500mg', 'Amoxicillin 250mg', 'Cetirizine 10mg', 'Metformin 500mg'].map(med => (
               <div key={med} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                 <p className="font-bold text-gray-900">{med}</p>
                 <p className="text-xs text-gray-500 mt-1">Stock: 120 units</p>
               </div>
             ))}
          </div>
        </div>
      );
      case 'Invoices': return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold">Purchase Invoices</h2>
            <button 
              onClick={() => setIsInvoiceModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-blue-700 transition-colors"
            >
              <Upload size={18} />
              <span>Upload New</span>
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-50">
                <th className="pb-4">Reference Number</th>
                <th className="pb-4">Supplier</th>
                <th className="pb-4">Date</th>
                <th className="pb-4">GST</th>
                <th className="pb-4">Total Value</th>
                <th className="pb-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
               {[
                 { ref: 'INV-152467812', supplier: 'AKG Enterprises', date: '2026-03-15', gst: '₹12.50', total: '₹1524.00' },
                 { ref: 'INV-173338102', supplier: 'Alpha Technologies', date: '2026-03-12', gst: '₹8.00', total: '₹2200.00' },
               ].map((inv, i) => (
                 <tr key={i} className="hover:bg-gray-50 transition-colors">
                   <td className="py-4 font-mono font-bold text-blue-600">{inv.ref}</td>
                   <td className="py-4">{inv.supplier}</td>
                   <td className="py-4 text-gray-600">{inv.date}</td>
                   <td className="py-4 text-gray-500">{inv.gst}</td>
                   <td className="py-4 font-bold text-gray-900">{inv.total}</td>
                   <td className="py-4 text-right">
                     <button className="text-gray-400 hover:text-blue-600">Details</button>
                   </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      );
      default: return <DashboardHome setView={setActiveView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100">
      {/* Sidebar - Same */}
      {/* (Skipping identical sidebar code for brevity in tool call, usually I'd keep it all but the user sees the diff) */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col h-screen sticky top-0">
        <div className="flex items-center space-x-3 mb-10 px-2 group cursor-pointer" onClick={() => setActiveView('Dashboard')}>
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
            <Pill size={24} />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-gray-900">PharmaCore</span>
        </div>
        
        <nav className="space-y-1.5 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'Dashboard'} onClick={() => setActiveView('Dashboard')} />
          <SidebarItem icon={Building2} label="Suppliers" active={activeView === 'Suppliers'} onClick={() => setActiveView('Suppliers')} />
          <SidebarItem icon={Pill} label="Medicines" active={activeView === 'Medicines'} onClick={() => setActiveView('Medicines')} />
          <SidebarItem icon={FileText} label="Invoices" active={activeView === 'Invoices'} onClick={() => setActiveView('Invoices')} />
        </nav>

        <div className="pt-6 border-t border-gray-100 space-y-1.5">
          <SidebarItem icon={Settings} label="Settings" active={activeView === 'Settings'} onClick={() => setActiveView('Settings')} />
          <div className="mt-4 p-4 bg-blue-50 rounded-2xl">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Database</p>
            <p className="text-xs text-blue-800 font-medium">Auto-sync active</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header - Same */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{activeView}</h1>
            <p className="text-gray-500 text-sm mt-1">Inventory Management System</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all w-72 text-sm shadow-sm"
              />
            </div>
            <button className="p-2.5 text-gray-500 bg-white border border-gray-100 hover:border-blue-200 hover:text-blue-600 rounded-2xl transition-all shadow-sm relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center space-x-3 px-1.5 py-1.5 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <User size={18} />
              </div>
            </div>
          </div>
        </header>

        {renderContent()}

        {/* Modals */}
        <Modal 
          isOpen={isInvoiceModalOpen || activeView === 'Upload'} 
          onClose={() => {
            setIsInvoiceModalOpen(false);
            if (activeView === 'Upload') setActiveView('Dashboard');
          }} 
          title="Upload New Invoice"
        >
          <InvoiceUploadForm onCancel={() => {
            setIsInvoiceModalOpen(false);
            if (activeView === 'Upload') setActiveView('Dashboard');
          }} />
        </Modal>

        <Modal 
          isOpen={isSupplierModalOpen} 
          onClose={() => {
            setIsSupplierModalOpen(false);
            setEditingSupplier(null);
          }} 
          title={editingSupplier ? "Edit Supplier" : "Add New Supplier"}
        >
          <SupplierForm 
            supplier={editingSupplier} 
            onSave={handleSaveSupplier} 
            onCancel={() => {
              setIsSupplierModalOpen(false);
              setEditingSupplier(null);
            }} 
          />
        </Modal>
      </main>
    </div>
  );
};

export default App;
