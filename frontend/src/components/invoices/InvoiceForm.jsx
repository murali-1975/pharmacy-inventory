import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, FileText, User, CreditCard, Tag, Package } from 'lucide-react';

const MedicineAutocomplete = ({ medicines, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Initialize query from value
  useEffect(() => {
    if (value) {
      const med = medicines.find(m => m.id === value);
      if (med) setQuery(med.product_name);
    } else {
      setQuery('');
    }
  }, [value, medicines]);

  const filteredMedicines = query === '' 
    ? [] 
    : medicines.filter(m => m.product_name.toLowerCase().includes(query.toLowerCase()) || (m.generic_name && m.generic_name.toLowerCase().includes(query.toLowerCase()))).slice(0, 50);

  return (
    <div className="relative">
      <input
        type="text"
        required={!value}
        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
        placeholder="Type to search medicines..."
        value={query}
        onChange={(e) => {
           setQuery(e.target.value);
           setIsOpen(true);
           setHighlightedIndex(0);
           if (!e.target.value) onChange(''); // clear back to empty state
        }}
        onFocus={() => {
           if (query) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={(e) => {
          if (!isOpen || filteredMedicines.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, filteredMedicines.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onChange(filteredMedicines[highlightedIndex].id);
            setQuery(filteredMedicines[highlightedIndex].product_name);
            setIsOpen(false);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      />
      {isOpen && filteredMedicines.length > 0 && (
        <ul className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-auto left-0">
          {filteredMedicines.map((item, index) => (
            <li
              key={item.id}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                index === highlightedIndex ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                onChange(item.id);
                setQuery(item.product_name);
                setIsOpen(false);
              }}
            >
              <div className="flex flex-col">
                <span>{item.product_name}</span>
                {item.generic_name && <span className="text-[10px] text-gray-400 font-bold mt-0.5">{item.generic_name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const InvoiceForm = ({ 
  onSave, 
  initialData, 
  suppliers, 
  medicines, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    supplier_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    total_value: 0,
    gst: 0,
    status: 'Pending',
    line_items: []
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        invoice_date: new Date(initialData.invoice_date).toISOString().split('T')[0],
        line_items: initialData.line_items || []
      });
    }
  }, [initialData]);

  const selectedSupplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
  const isPharmacy = [1, 2, 3].includes(selectedSupplier?.type_id) || selectedSupplier?.type?.name?.toLowerCase().includes('pharma') || selectedSupplier?.type?.name?.toLowerCase().includes('wholesale') || selectedSupplier?.type?.name?.toLowerCase().includes('retail');

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        { 
          medicine_id: isPharmacy ? '' : null, 
          description: isPharmacy ? '' : '', 
          quantity: 1, 
          free_quantity: 0,
          price: 0, 
          discount: 0, 
          mrp: 0,
          gst: 0,
          batch_no: isPharmacy ? '' : null,
          expiry_date: isPharmacy ? '' : null 
        }
      ]
    });
  };

  const removeLineItem = (index) => {
    const newList = [...formData.line_items];
    newList.splice(index, 1);
    setFormData({ ...formData, line_items: newList });
  };

  const updateLineItem = (index, field, value) => {
    const newList = [...formData.line_items];
    newList[index] = { ...newList[index], [field]: value };
    setFormData({ ...formData, line_items: newList });
  };

  const calculateTotal = () => {
    const total = formData.line_items.reduce((acc, item) => {
      const lineTotal = (item.quantity * item.price);
      return acc + lineTotal;
    }, 0);
    return total + (parseFloat(formData.gst) || 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-h-[80vh] overflow-y-auto px-2 py-4">
      {/* Supplier & Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-500/20" />
        
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Supplier</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: parseInt(e.target.value) })}
            >
              <option value="">Select Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.supplier_name} ({s.type?.name})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Invoice Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Invoice Number</label>
          <div className="relative">
            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              required
              placeholder="e.g. INV-2024-001"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">GST Amount (₹)</label>
          <div className="relative">
            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
              value={formData.gst}
              onChange={(e) => setFormData({ ...formData, gst: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Total Invoice Value (₹)</label>
          <div className="relative">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full bg-blue-50/30 border border-blue-100 text-blue-900 rounded-2xl pl-12 pr-4 py-4 font-black focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              value={formData.total_value}
              onChange={(e) => setFormData({ ...formData, total_value: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Invoice Status</label>
          <div className="relative">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              required
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Hold">Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="text-blue-500" size={20} />
            </div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Line Items</h3>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-lg active:scale-95 shadow-blue-500/20 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!formData.supplier_id}
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-4">
          {formData.line_items.map((item, index) => (
            <div key={index} className="group bg-gray-50/50 hover:bg-white p-6 rounded-[24px] border border-gray-100 transition-all hover:shadow-md relative">
              <button
                type="button"
                onClick={() => removeLineItem(index)}
                className="absolute -right-2 -top-2 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
              >
                <Trash2 size={14} />
              </button>

              <div className="space-y-4">
                {/* Row 1: Item, Batch, Expiry */}
                <div className="grid grid-cols-12 gap-3 items-end">
                  {isPharmacy ? (
                    <>
                      <div className="col-span-6 md:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Item Description</label>
                        <MedicineAutocomplete
                          medicines={medicines}
                          value={item.medicine_id}
                          onChange={(val) => updateLineItem(index, 'medicine_id', val)}
                        />
                      </div>
                      <div className="col-span-3 md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Batch No</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. BATCH-A1"
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                          value={item.batch_no || ''}
                          onChange={(e) => updateLineItem(index, 'batch_no', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3 md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Expiry Date</label>
                        <div className="relative">
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="date"
                            required
                            className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-10 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none appearance-none"
                            value={item.expiry_date || ''}
                            onChange={(e) => updateLineItem(index, 'expiry_date', e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-12 space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Item Description</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter item description..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Row 2: Qty, Free Qty, Price, MRP, GST, Disc, Total */}
                <div className="flex flex-wrap gap-x-3 gap-y-4 items-end pt-2 border-t border-gray-100/50">
                  <div className="flex-1 min-w-[70px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Qty</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-center"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-1 min-w-[70px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase text-center block">Free Qty</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-center"
                      value={item.free_quantity || 0}
                      onChange={(e) => updateLineItem(index, 'free_quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-[1.2] min-w-[90px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      value={item.price}
                      onChange={(e) => updateLineItem(index, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-[1.2] min-w-[90px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      value={item.mrp || 0}
                      onChange={(e) => updateLineItem(index, 'mrp', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-1 min-w-[70px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">GST %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      value={item.gst || 0}
                      onChange={(e) => updateLineItem(index, 'gst', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-1 min-w-[70px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Disc (₹)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      value={item.discount}
                      onChange={(e) => updateLineItem(index, 'discount', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="flex-1 min-w-[100px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase text-right block">Line Total</label>
                    <div className="text-[13px] font-black text-blue-600 h-[42px] flex items-center justify-end pr-2">
                        ₹{(item.quantity * item.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {formData.line_items.length === 0 && (
            <div className="bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[32px] py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-white rounded-full shadow-sm text-gray-300">
                <Plus size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-gray-900 font-black uppercase text-xs tracking-widest">No Items Added</p>
                <p className="text-[10px] text-gray-400 font-bold">Add at least one item to save the invoice</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Invoice Value</p>
          <div className="text-3xl font-black text-gray-900 tracking-tighter">₹{formData.total_value.toLocaleString()}</div>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-4 rounded-2xl font-bold text-gray-400 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95"
          >
            {initialData ? 'Update & Save' : 'Confirm & Save Invoice'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default InvoiceForm;
