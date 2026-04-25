import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DailySummaryReport from '../views/Finance/DailySummaryReport';
import api from '../api';

// Mock the API
vi.mock('../api', () => ({
  default: {
    getDailyFinanceSummaries: vi.fn(),
    getFinanceMasters: vi.fn()
  }
}));

const mockMasters = {
  services: [
    { id: 1, service_name: 'Consultation' },
    { id: 2, service_name: 'Medicine' }
  ],
  payment_modes: [
    { id: 10, mode: 'Cash' },
    { id: 11, mode: 'UPI' }
  ]
};

const mockSummaryResponse = {
  total: 15,
  items: [
    {
      summary_date: '2026-04-25',
      patient_count: 10,
      total_revenue: 5000,
      total_collected: 4500,
      total_gst: 200,
      service_breakdown: { 'Consultation': 3000, 'Medicine': 2000 },
      payment_breakdown: { 'Cash': 3500, 'UPI': 1000 }
    },
    {
      summary_date: '2026-04-24',
      patient_count: 5,
      total_revenue: 2000,
      total_collected: 2000,
      total_gst: 50,
      service_breakdown: { 'Consultation': 1000, 'Medicine': 1000 },
      payment_breakdown: { 'Cash': 2000 }
    }
  ],
  grand_total: {
    patient_count: 100,
    total_revenue: 50000,
    total_collected: 48000,
    total_gst: 2500,
    service_breakdown: { 'Consultation': 30000, 'Medicine': 20000 },
    payment_breakdown: { 'Cash': 38000, 'UPI': 10000 }
  }
};

describe('DailySummaryReport Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getFinanceMasters.mockResolvedValue(mockMasters);
    api.getDailyFinanceSummaries.mockResolvedValue(mockSummaryResponse);
  });

  it('renders correctly and displays grand totals from backend', async () => {
    render(<DailySummaryReport token="fake-token" />);

    // Wait for data to load
    await waitFor(() => expect(screen.getByText('Daily Financial Aggregates')).toBeInTheDocument());

    // Check if mock items are rendered
    expect(screen.getByText('25 Apr 2026')).toBeInTheDocument();
    expect(screen.getByText('24 Apr 2026')).toBeInTheDocument();

    // Verify Grand Totals (from backend, not local calc)
    // We expect 50,000 for total revenue
    const grandTotalRow = screen.getByText('Grand Total').parentElement;
    expect(grandTotalRow).toHaveTextContent('100'); // Total patients
    expect(grandTotalRow).toHaveTextContent('50,000'); // Total revenue
    expect(grandTotalRow).toHaveTextContent('2,500'); // Total GST
  });

  it('handles pagination clicking', async () => {
    render(<DailySummaryReport token="fake-token" />);

    await waitFor(() => screen.getByText('25 Apr 2026'));

    // Check pagination status
    expect(screen.getByText(/Showing 1 to 10 of 15 days/i)).toBeInTheDocument();

    // Click Next
    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    // Should trigger new API call with skip=10
    await waitFor(() => {
      expect(api.getDailyFinanceSummaries).toHaveBeenCalledWith(
        'fake-token',
        expect.any(String), // start date
        expect.any(String), // end date
        10, // skip
        10  // limit
      );
    });
  });

  it('changes page size correctly', async () => {
    render(<DailySummaryReport token="fake-token" />);

    await waitFor(() => screen.getByText('25 Apr 2026'));

    const pageSizeSelect = screen.getByRole('combobox');
    fireEvent.change(pageSizeSelect, { target: { value: '25' } });

    // Should trigger new API call with skip=0, limit=25
    await waitFor(() => {
      expect(api.getDailyFinanceSummaries).toHaveBeenCalledWith(
        'fake-token',
        expect.any(String),
        expect.any(String),
        0,
        25
      );
    });
  });
});
