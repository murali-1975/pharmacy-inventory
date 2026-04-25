import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentHistoryTable from '../views/Finance/PaymentHistoryTable';
import React from 'react';

describe('PaymentHistoryTable Component', () => {
  const mockPayments = {
    total: 15,
    items: [
      {
        id: 1,
        patient_name: 'John Doe',
        payment_date: '2023-10-01',
        total_amount: 1500,
        token_no: 101,
        identifiers: [{ id_value: 'UHID-123' }],
        services: [{ service_id: 1 }]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPayments)
    });
  });

  it('renders history table with mock data', async () => {
    render(<PaymentHistoryTable token="fake-token" />);
    expect(await screen.findByText(/John Doe/i)).toBeInTheDocument();
    expect(await screen.findByText(/UHID-123/i)).toBeInTheDocument();
    expect(await screen.findAllByText(/1,500/i)).toHaveLength(2); // Bill and Due (since payments are missing in mock)
  });

  it('shows pagination controls', async () => {
    render(<PaymentHistoryTable token="fake-token" />);
    expect(await screen.findByText(/Page 1/i)).toBeInTheDocument();
    const nextBtn = await screen.findByRole('button', { name: /Next/i });
    expect(nextBtn).toBeInTheDocument();
  });

  it('handles search input', async () => {
    render(<PaymentHistoryTable token="fake-token" />);
    const searchInput = screen.getByPlaceholderText(/Search by patient name/i);
    fireEvent.change(searchInput, { target: { value: 'John' } });
    // Fetch should be called with query param
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patient_name=John'),
        expect.any(Object)
      );
    }, { timeout: 1000 });
  });
});
