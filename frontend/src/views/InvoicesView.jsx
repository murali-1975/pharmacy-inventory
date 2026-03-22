import React, { useState } from 'react';
import { Search, Plus, FileText, Calendar, Truck, CreditCard, ChevronRight, Edit, Trash2 } from 'lucide-react';

/**
 * Component for viewing and managing purchase invoices.
 * 
 * @param {Object} props - Component properties.
 * @param {Array} props.invoices - List of invoices to display.
 * @param {function} props.onAddClick - Callback to open the add invoice modal.
 * @param {function} props.onEditClick - Callback to open the edit invoice modal.
 * @param {function} props.onDeleteClick - Callback to delete an invoice.
 * @param {Object} props.currentUser - The currently logged-in user.
 */
const InvoicesView = ({ 
  invoices, 
  onAddClick, 
  onEditClick, 
  onDeleteClick,
  currentUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = invoices.filter(inv => 
    (inv.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.supplier?.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-gray-500">Record and track inventory purchases</p>
        </div>
        <button 
          onClick={onAddClick}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center space-x-2"
        >
          <Plus size={20} />
          <span>New Invoice</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by invoice # or supplier..."
          className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Value</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInvoices.map(invoice => (
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
                  <td className="px-6 py-5 text-right">
                    <div className="text-sm font-black text-gray-900">₹{invoice.total_value.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Incl. GST: ₹{invoice.gst}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
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
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesView;
