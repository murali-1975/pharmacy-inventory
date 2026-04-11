import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import StockView from '../views/StockView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('Inventory Ledger Frontend', () => {
  const mockMedicines = [
    { id: 1, product_name: 'Paracetamol', generic_name: 'Acetaminophen', uom: 'Tablet', category: 'General' }
  ];

  const mockLedgerResponse = {
    total: 1,
    items: [
      {
        medicine_id: 1,
        product_name: 'Paracetamol',
        generic_name: 'Acetaminophen',
        category: 'General',
        uom: 'Tablet',
        opening_balance: 100,
        quantity_in: 50,
        quantity_out: 20,
        stock_in_hand: 130
      }
    ]
  };

  const defaultProps = {
    medicinesList: mockMedicines,
    onRefreshMedicines: vi.fn(),
    token: 'test-token',
    userRole: 'Admin'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/ledger')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockLedgerResponse
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [], total: 0 })
      });
    });
  });

  it('navigates to Inventory Ledger tab and loads data', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    const ledgerTab = screen.getByText(/Inventory Ledger/i);
    fireEvent.click(ledgerTab);

    expect(await screen.findByText(/Medicine Name/i)).toBeInTheDocument();
    
    // Wait for the data to actually load into the table
    await screen.findByText('130');
    
    // Check if Paracetamol is in the ledger table
    expect(screen.getAllByText('Paracetamol').length).toBeGreaterThan(0);
    expect(screen.getByText('100')).toBeInTheDocument(); // Opening
    expect(screen.getByText('+50')).toBeInTheDocument();  // In
    expect(screen.getByText('-20')).toBeInTheDocument();  // Out
  });

  it('triggers a new fetch when the date range changes', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Inventory Ledger/i));

    await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/ledger'),
            expect.any(Object)
        );
    });

    // Change "From" date
    const fromInput = screen.getByLabelText(/From/i);
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
    
    // Clicking "Apply Filters" happens automatically on state change in current implementation or requires explicit load?
    // In StockView.jsx, useEffect depends on dateRange.
    
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('from_date=2024-01-01'),
        expect.any(Object)
      );
    });
  });

  it('shows the PDF export button', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Inventory Ledger/i));

    const exportBtn = screen.getByText(/Export PDF/i);
    expect(exportBtn).toBeInTheDocument();
  });
});
