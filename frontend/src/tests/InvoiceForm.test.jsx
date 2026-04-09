import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import InvoiceForm from '../components/invoices/InvoiceForm.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('InvoiceForm Component', () => {
  const mockSuppliers = [
    { id: 1, supplier_name: 'Pharma Wholesale', type: { name: 'Wholesaler' }, type_id: 1 }
  ];
  const mockMedicines = [
    { id: 1, product_name: 'Dolo 650', generic_name: 'Paracetamol' }
  ];

  const defaultProps = {
    suppliers: mockSuppliers,
    medicines: mockMedicines,
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  it('renders correctly with default values', () => {
    render(
      <TestWrapper>
        <InvoiceForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Confirm & Save Invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/No Items Added/i)).toBeInTheDocument();
  });

  it('adds a line item and updates the total', async () => {
    render(
      <TestWrapper>
        <InvoiceForm {...defaultProps} />
      </TestWrapper>
    );

    // Select supplier first (required to enable Add Item button)
    const supplierSelect = screen.getByRole('combobox', { name: /Supplier/i });
    fireEvent.change(supplierSelect, { target: { value: '1' } });

    const addBtn = screen.getByText(/Add Item/i);
    fireEvent.click(addBtn);

    expect(screen.getByText(/Line Items/i)).toBeInTheDocument();
    
    // Fill quantity and price
    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '10' } });

    // Find price input (there might be multiple, but only one currently)
    const priceInputs = screen.getAllByRole('spinbutton');
    // qty is index 1, price is index 2, mrp index 3, gst index 4
    // Wait, let's look at the labels
    const priceInput = screen.getByLabelText(/Price \(₹\)/i);
    fireEvent.change(priceInput, { target: { value: '50' } });

    // Total should be 10 * 50 = 500
    expect(screen.getByText('₹500.00')).toBeInTheDocument();
  });

  it('calls onSave with form data when submitted', async () => {
    const { container } = render(
      <TestWrapper>
        <InvoiceForm {...defaultProps} />
      </TestWrapper>
    );

    // Fill header
    fireEvent.change(screen.getByRole('combobox', { name: /Supplier/i }), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Invoice Number/i), { target: { value: 'INV-001' } });
    fireEvent.change(screen.getByLabelText(/Total Invoice Value/i), { target: { value: '500' } });

    // Add line item
    fireEvent.click(screen.getByText(/Add Item/i));
    
    // Fill required line item fields
    // Medicine search
    const medSearch = screen.getByPlaceholderText(/Type to search medicines/i);
    fireEvent.change(medSearch, { target: { value: 'Dolo' } });
    const medResult = await screen.findByText(/Dolo 650/i);
    fireEvent.mouseDown(medResult);

    // Batch and Expiry
    fireEvent.change(screen.getByPlaceholderText(/e.g. BATCH-A1/i), { target: { value: 'B1' } });
    // Date input for expiry
    const expiryInputs = container.querySelectorAll('input[type="date"]');
    // index 0 is invoice date, index 1 is expiry date
    fireEvent.change(expiryInputs[1], { target: { value: '2025-12-31' } });

    const submitBtn = screen.getByText(/Confirm & Save Invoice/i);
    fireEvent.click(submitBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      reference_number: 'INV-001',
      total_value: 500,
      line_items: expect.arrayContaining([
        expect.objectContaining({ medicine_id: 1 })
      ])
    }));
  });
});
