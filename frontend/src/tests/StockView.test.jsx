import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import StockView from '../views/StockView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('StockView Component', () => {
  const mockMedicines = [
    { id: 1, product_name: 'Paracetamol', generic_name: 'Acetaminophen', uom: 'Tablet', category: 'General' },
    { id: 2, product_name: 'Amoxicillin', generic_name: 'Amoxicillin', uom: 'Capsule', category: 'Antibiotic' }
  ];

  const mockStockResponse = {
    items: [
      {
        id: 1,
        medicine_id: 1,
        quantity_on_hand: 50,
        reorder_level: 20,
        unit_price: 5.0,
        gst_percent: 12,
        last_updated_at: '2024-03-20T10:00:00Z',
        medicine: mockMedicines[0]
      }
    ],
    total: 1
  };

  const defaultProps = {
    medicinesList: mockMedicines,
    token: 'test-token',
    userRole: 'Admin'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/stock/?')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockStockResponse
        });
      }
      if (url.includes('/adjustments')) {
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders the stock overview by default', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Stock Management/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
    });
  });

  it('switches to Adjust Stock tab and submits adjustment', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    const adjustTab = screen.getByText(/Adjust Stock/i);
    fireEvent.click(adjustTab);

    // Fill form
    const qtyInput = screen.getByLabelText(/Quantity Change/i);
    const reasonInput = screen.getByLabelText(/Reason/i);
    const submitBtn = screen.getByRole('button', { name: /Apply Adjustment/i });

    // Select medicine (it's a select element)
    // Find the select by label/placeholder equivalent (it's the first one usually)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(qtyInput, { target: { value: '10' } });
    fireEvent.change(reasonInput, { target: { value: 'Correction' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/stock/adjust'),
          expect.objectContaining({ method: 'POST' })
        );
    });
  });

  it('shows low stock alert when quantity is below reorder level', async () => {
    const lowStockResponse = {
      items: [{
        ...mockStockResponse.items[0],
        quantity_on_hand: 5,
        reorder_level: 20
      }],
      total: 1
    };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => lowStockResponse
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Low Stock/i)).toBeInTheDocument();
    });
  });

  it('switches to Price List tab', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    const priceTab = screen.getByText(/Price List/i);
    fireEvent.click(priceTab);

    await waitFor(() => {
      expect(screen.getByText(/Unit Price \(₹\)/i)).toBeInTheDocument();
      expect(screen.getByText('₹5')).toBeInTheDocument();
    });
  });
});
