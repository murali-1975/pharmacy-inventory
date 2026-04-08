import React, { useState, useRef } from 'react';
import { 
  Search, Plus, FileText, Truck, Edit, Trash2, IndianRupee, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Upload 
} from 'lucide-react';
import PaymentForm from '../components/invoices/PaymentForm';
import BulkUploadModal from '../components/invoices/BulkUploadModal';

const InvoicesView = ({ 
  invoices, 
  onAddClick, 
  onEditClick, 
  onDeleteClick,
  currentUser,
  currentPage,
  totalInvoices,
  pageSize,
  onChangePage,
  onRefresh,
  onSavePayment,
  onSearch,
  searchTerm: activeSearchTerm,
  sortBy,
  sortOrder,
  onSort,
  token
}) => {
  const [localSearch, setLocalSearch] = useState(activeSearchTerm || '');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const debounceRef = useRef(null);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (onSearch) onSearch(value);
    }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));

  // Sortable Header Component
  const SortableHeader = ({ label, field, first = false, last = false }) => {
    const isActive = sortBy === field;
    return (
      <th 
        className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors group ${last ? 'text-right' : 'text-left'}`}
        onClick={() => onSort(field)}
      >
        <div className={`flex items-center space-x-1 ${last ? 'justify-end' : ''}`}>
          <span>{label}</span>
          <div className={`transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {isActive && sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-gray-500">Record and track inventory purchases</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button 
            onClick={() => setShowUploadModal(true)}
            className="bg-white text-gray-700 px-6 py-3 rounded-2xl font-bold border border-gray-100 shadow-sm hover:bg-gray-50 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Upload size={20} />
            <span>Bulk Import</span>
          </button>
          <button 
            onClick={onAddClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by invoice # or supplier..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={localSearch}
          onChange={handleInputChange}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <SortableHeader label="Invoice #" field="reference_number" />
                <SortableHeader label="Date" field="invoice_date" />
                <SortableHeader label="Supplier" field="supplier_name" />
                <SortableHeader label="Status" field="status" />
                <SortableHeader label="Total" field="total_value" last />
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Paid</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-2.5 bg-gray-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                        <FileText size={20} />
                      </div>
                      <div className="text-sm font-bold text-gray-900">{invoice.reference_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-600 font-medium">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center text-sm text-gray-900 font-bold">
                      <Truck size={14} className="mr-2 text-gray-400" />
                      {invoice.supplier?.supplier_name || 'General Supplier'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      invoice.status === 'Paid' ? 'bg-green-100 text-green-600' :
                      invoice.status === 'Hold' ? 'bg-orange-100 text-orange-600' :
                      invoice.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {invoice.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-sm font-black text-gray-900">₹{invoice.total_value.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Incl. GST: ₹{invoice.gst}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {(() => {
                      const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.paid_amount, 0);
                      const balance = invoice.total_value - totalPaid;
                      return (
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-blue-600">₹{totalPaid.toLocaleString()}</span>
                          {balance > 0 && (
                            <span className="text-[10px] font-bold text-orange-500 uppercase">Due: ₹{balance.toLocaleString()}</span>
                          )}
                          {balance <= 0 && totalPaid > 0 && (
                            <span className="text-[10px] font-bold text-green-500 uppercase">Settled</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => setSelectedInvoiceForPayment(invoice)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        title="View / Record Payment"
                      >
                        <IndianRupee size={18} />
                      </button>
                      <button 
                        onClick={() => onEditClick(invoice)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit Invoice"
                      >
                        <Edit size={18} />
                      </button>
                      {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
                        <button 
                          onClick={() => onDeleteClick(invoice.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Invoice"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500 font-medium">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with Pagination */}
        <div className="bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between px-6 py-6 gap-4">
          <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
            Showing <span className="font-bold text-gray-900">{invoices.length ? (currentPage - 1) * pageSize + 1 : 0}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, totalInvoices)}</span> of <span className="font-bold text-gray-900">{totalInvoices}</span> invoices
          </div>
          
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => onChangePage(1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-xl text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="First Page"
            >
              <ChevronsLeft size={18} />
            </button>
            <button 
              onClick={() => onChangePage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-xl text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all mr-2"
              title="Previous Page"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
              Page {currentPage} of {totalPages}
            </div>
            
            <button 
              onClick={() => onChangePage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-xl text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all ml-2"
              title="Next Page"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => onChangePage(totalPages)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-xl text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Last Page"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>

        {activeSearchTerm && (
          <div className="bg-blue-50/30 border-t border-blue-100 flex items-center justify-center px-6 py-3">
            <div className="text-xs text-blue-500 font-semibold tracking-wide uppercase">
              Searching for: <span className="text-blue-700 italic">"{activeSearchTerm}"</span> • {totalInvoices} results
            </div>
          </div>
        )}
      </div>

      {selectedInvoiceForPayment && (
        <PaymentForm 
          invoice={selectedInvoiceForPayment}
          currentUser={currentUser}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onSave={async (id, data) => {
            await onSavePayment(id, data);
            setSelectedInvoiceForPayment(null);
          }}
        />
      )}

      {showUploadModal && (
        <BulkUploadModal 
          token={token}
          onClose={() => setShowUploadModal(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};

export default InvoicesView;
