import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FinancialsView from '../views/FinancialsView';

describe('FinancialsView', () => {
  const mockToken = 'test-token';

  const mockValuation = {
    total_cost_value: 50000,
    total_mrp_value: 75000,
    batch_count: 15
  };

  const mockAging = [
    {
      supplier_id: 1,
      supplier_name: 'Main Pharma',
      balance_due: 5000,
      total_invoiced: 20000
    }
  ];

  const mockGst = {
    input_gst: 1000,
    output_gst: 1500,
    net_gst_liability: 500
  };

  const mockProfit = [
    {
      medicine_id: 1,
      medicine_name: 'Paracetamol',
      quantity_sold: 100,
      revenue: 1000,
      gross_profit: 200,
      margin_percent: 20
    }
  ];

  const mockPeriodSummary = {
    opening_valuation: 10000,
    inventory_added: 5000,
    revenue: 3000,
    cost_of_goods_sold: 2000,
    net_adjustments: 0,
    gross_profit: 1000,
    closing_valuation: 13000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/financials/valuation')) return Promise.resolve({ ok: true, json: async () => mockValuation });
      if (url.includes('/api/financials/aging')) return Promise.resolve({ ok: true, json: async () => mockAging });
      if (url.includes('/api/financials/gst')) return Promise.resolve({ ok: true, json: async () => mockGst });
      if (url.includes('/api/financials/profit')) return Promise.resolve({ ok: true, json: async () => mockProfit });
      if (url.includes('/api/financials/period-summary')) return Promise.resolve({ ok: true, json: async () => mockPeriodSummary });
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  it('renders loading state initially', () => {
    // We need a way to prevent immediate resolution to see loading state
    // but for now let's just test that the data renders after loading
    render(<FinancialsView token={mockToken} />);
    expect(screen.getByText(/Crunching financial data/i)).toBeInTheDocument();
  });

  it('renders stats correctly after loading', async () => {
    await React.act(async () => {
      render(<FinancialsView token={mockToken} />);
    });
    
    await waitFor(() => expect(screen.queryByText(/Crunching financial data/i)).not.toBeInTheDocument());

    expect(screen.getByText('Financial Reports')).toBeInTheDocument();
    
    // Check StatCards (using regular expressions to match formatted numbers)
    expect(screen.getByText('₹75,000')).toBeInTheDocument(); // MRP Value
    expect(screen.getByText(/15 Active Batches/)).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument(); // GST Liability
  });

  it('renders profitability and aging tables', async () => {
    await React.act(async () => {
      render(<FinancialsView token={mockToken} />);
    });
    
    await waitFor(() => expect(screen.queryByText(/Crunching financial data/i)).not.toBeInTheDocument());

    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Main Pharma')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument(); // Balance due
  });

  it('handles error state', async () => {
    globalThis.fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }));
    
    await React.act(async () => {
      render(<FinancialsView token={mockToken} />);
    });
    
    expect(await screen.findByText(/Failed to fetch one or more financial reports/i)).toBeInTheDocument();
  });

  it('refetches data when dates change', async () => {
    const { container } = render(<FinancialsView token={mockToken} />);
    
    await waitFor(() => expect(screen.queryByText(/Crunching financial data/i)).not.toBeInTheDocument());
    
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
    
    const refreshBtn = screen.getByTitle(/Refresh Data/i);
    fireEvent.click(refreshBtn);
    
    expect(globalThis.fetch).toHaveBeenCalledTimes(10); // 5 initial + 5 refresh
  });
  
  it('handles null financial values by defaulting to 0 without crashing', async () => {
    // Mock response with null values (simulating medicines without price data)
    const nullValuation = {
      total_cost_value: null,
      total_mrp_value: null,
      batch_count: 0
    };
    
    globalThis.fetch.mockImplementation((url) => {
       if (url.includes('/api/financials/valuation')) return Promise.resolve({ ok: true, json: async () => nullValuation });
       if (url.includes('/api/financials/profit') || url.includes('/api/financials/aging')) {
         return Promise.resolve({ ok: true, json: async () => [] });
       }
       return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await React.act(async () => {
      render(<FinancialsView token={mockToken} />);
    });
    
    await waitFor(() => expect(screen.queryByText(/Crunching financial data/i)).not.toBeInTheDocument());

    // Should display ₹0 instead of ₹undefined
    const costCards = screen.getAllByText('₹0');
    expect(costCards.length).toBeGreaterThan(0);
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
