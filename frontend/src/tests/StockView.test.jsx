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
        unit_price: 5,
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
    // Default mock response
    globalThis.fetch = vi.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: async () => mockStockResponse
      })
    );
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
    });
  });

  it('switches to Adjust Stock tab', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    const adjustTab = screen.getByText(/Adjust Stock/i);
    fireEvent.click(adjustTab);

    expect(screen.getByText(/Manual Stock Adjustment/i)).toBeInTheDocument();
  });

  it('shows low stock alert and handles search', async () => {
    const lowStockResponse = {
      items: [{
        ...mockStockResponse.items[0],
        quantity_on_hand: 5,
        reorder_level: 20
      }],
      total: 1
    };
    
    globalThis.fetch.mockResolvedValueOnce({
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

    const searchInput = screen.getByPlaceholderText(/Search by product name/i);
    fireEvent.change(searchInput, { target: { value: 'Para' } });
    
    await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
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

    expect(screen.getByText(/Export ALL to PDF/i)).toBeInTheDocument();
  });

  it('enters Initialize Stock tab', async () => {
    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    const initTab = screen.getByText(/Initialize Stock/i);
    fireEvent.click(initTab);

    expect(screen.getByText(/Initialize Opening Stock Balance/i)).toBeInTheDocument();
  });

  it('handles pagination rendering if total is large', async () => {
    // PRE-MOCK for initial fetch
    globalThis.fetch = vi.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: async () => ({ ...mockStockResponse, total: 50 })
        })
    );

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    // Wait for the "Showing" summary which only appears when data is loaded
    await waitFor(() => {
        expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    });

    // Page indicator (50 items / 20 per page = 3 pages)
    expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
  });

  it('handles stock adjustment submission', async () => {
    // Mock the POST adjustment endpoint
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/stock/adjust')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success' }) });
      }
      return Promise.resolve({ ok: true, json: async () => mockStockResponse });
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Adjust Stock/i));
    
    // Fill the form
    fireEvent.change(screen.getByLabelText(/Medicine/i, { selector: 'select' }), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Quantity Change/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Found extra' } });
    
    fireEvent.click(screen.getByText(/Apply Adjustment/i));

    await waitFor(() => {
      expect(screen.getByText(/Adjustment applied successfully/i)).toBeInTheDocument();
    });
  });

  it('handles opening stock initialization', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/stock/initialize')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success' }) });
      }
      return Promise.resolve({ ok: true, json: async () => mockStockResponse });
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Initialize Stock/i));
    
    // Select the "Medicine" label (it might match multiple, so we can be specific)
    const medicineSelect = screen.getByLabelText('Medicine', { selector: 'select' });
    fireEvent.change(medicineSelect, { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Opening Quantity/i), { target: { value: '100' } });
    
    // Date is pre-filled
    fireEvent.click(screen.getByText(/Set Opening Balance/i));

    await waitFor(() => {
      expect(screen.getByText(/initialized successfully/i)).toBeInTheDocument();
    });
  });

  it('shows stock history when a row is clicked', async () => {
    const mockHistory = [
      { id: 101, quantity_change: 10, adjustment_type: 'MANUAL', reason: 'Test', adjusted_at: '2024-03-21T00:00:00Z' }
    ];

    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/adjustments')) {
        return Promise.resolve({ ok: true, json: async () => mockHistory });
      }
      if (url.includes('/stock/')) {
        return Promise.resolve({ ok: true, json: async () => mockStockResponse });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    // Click on the Paracetamol row
    const row = await screen.findByText('Paracetamol');
    fireEvent.click(row);

    // Details panel should appear
    expect(await screen.findByRole('heading', { name: /Adjustment History/i })).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('handles negative stock adjustment for write-offs', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/stock/adjust')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success' }) });
      }
      return Promise.resolve({ ok: true, json: async () => mockStockResponse });
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Adjust Stock/i));
    
    fireEvent.change(screen.getByLabelText(/Medicine/i, { selector: 'select' }), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Quantity Change/i), { target: { value: '-5' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Damaged' } });
    
    fireEvent.click(screen.getByText(/Apply Adjustment/i));

    await waitFor(() => {
      expect(screen.getByText(/Adjustment applied successfully/i)).toBeInTheDocument();
    });
  });

  it('handles 409 conflict and force-replace in initialization', async () => {
    let callCount = 0;
    globalThis.fetch.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/stock/initialize')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ detail: 'Already exists' })
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ status: 'success' }) });
      }
      return Promise.resolve({ ok: true, json: async () => mockStockResponse });
    });

    render(
      <TestWrapper>
        <StockView {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Initialize Stock/i));
    fireEvent.change(screen.getByLabelText('Medicine', { selector: 'select' }), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Opening Quantity/i), { target: { value: '100' } });
    fireEvent.click(screen.getByText(/Set Opening Balance/i));

    expect(await screen.findByText(/This medicine already has an Opening Balance/i)).toBeInTheDocument();

    const checkbox = screen.getByLabelText(/Yes, replace the existing Opening Balance/i);
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText(/initialized successfully/i)).toBeInTheDocument();
    });
  });
});
