import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DispensingView from '../views/DispensingView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('DispensingView Component', () => {
  const mockMedicines = [
    { 
        id: 1, 
        product_name: 'Dolo 650', 
        generic_name: 'Paracetamol', 
        selling_price_percent: 10 
    }
  ];

  const defaultProps = {
    medicines: mockMedicines,
    token: 'test-token',
    userRole: 'Admin'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/dispensing/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], total: 0 })
        });
      }
      if (url.includes('/batches')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            id: 101,
            batch_no: 'B001',
            mrp: 100,
            purchase_price: 80,
            gst: 12,
            expiry_date: '2025-01-01',
            quantity_on_hand: 50
          }]
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders the dispensing record form by default', () => {
    render(
      <TestWrapper>
        <DispensingView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: /Medicine Dispensing/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Patient Name/i)).toBeInTheDocument();
  });

  it('adds a new medicine row', () => {
    render(
      <TestWrapper>
        <DispensingView {...defaultProps} />
      </TestWrapper>
    );

    const addBtn = screen.getByText(/\+ Add Medicine/i);
    // Initially has 1 row
    const rowsBefore = screen.getAllByRole('button', { name: '✕' });
    expect(rowsBefore.length).toBe(1);

    fireEvent.click(addBtn);

    const rowsAfter = screen.getAllByRole('button', { name: '✕' });
    expect(rowsAfter.length).toBe(2);
  });

  it('autofills price when medicine is selected', async () => {
    render(
      <TestWrapper>
        <DispensingView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search medicine/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Dolo' } });

    // Find and click the result
    const result = await screen.findByText('Dolo 650');
    fireEvent.mouseDown(result);

    await waitFor(() => {
      // Unit price should be calculated: PurchasePrice (80) or MRP (100) - Disc (10%)
      // In DispensingView logic: calcPrice = mrp - (mrp * (spPercent / 100)) = 100 - 10 = 90
      const priceInput = screen.getByDisplayValue('90');
      expect(priceInput).toBeInTheDocument();
    });
  });

  it('saves dispensing records successfully', async () => {
    const { container } = render(
      <TestWrapper>
        <DispensingView {...defaultProps} />
      </TestWrapper>
    );

    // Fill header
    const patientName = screen.getByLabelText(/Patient Name/i);
    fireEvent.change(patientName, { target: { value: 'Test Patient' } });

    // Select medicine
    const searchInput = screen.getByPlaceholderText(/Search medicine/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Dolo' } });
    const result = await screen.findByText('Dolo 650');
    fireEvent.mouseDown(result);

    // WAIT for price to be auto-filled (from fetch)
    await screen.findByDisplayValue('90');

    // Set quantity
    // The quantity input is the first input with type number and placeholder 0
    const qtyInput = container.querySelector('input[type="number"][placeholder="0"]');
    fireEvent.change(qtyInput, { target: { value: '2' } });

    // Click Save All
    const saveBtn = screen.getByText(/Save All/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dispensing/'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(screen.getByText(/dispensing entries saved/i)).toBeInTheDocument();
    });
  });

  it('switches to history tab', async () => {
    render(
      <TestWrapper>
        <DispensingView {...defaultProps} />
      </TestWrapper>
    );

    const historyTab = screen.getByText(/Dispensing History/i);
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/dispensing/?'),
        expect.any(Object)
      );
    });
  });
});
