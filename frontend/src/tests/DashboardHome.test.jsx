import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DashboardHome from '../views/DashboardHome.jsx';

describe('DashboardHome Component', () => {
  const mockInvoices = [
    { id: 1, reference_number: 'INV-001', invoice_date: '2024-03-20', total_value: 1000 },
    { id: 2, reference_number: 'INV-002', invoice_date: '2024-03-21', total_value: 2000 }
  ];

  const mockStats = {
    total_medicines: 100,
    pending_invoices_amount: 5000,
    monthly_procurement: 15000,
    low_stock_alerts: 5
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockStats
      })
    );
  });

  it('renders loading state initially', () => {
    render(<DashboardHome token="test-token" />);
    // There is no role status, just check for the spinning icon
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('renders stats and recent invoices after loading', async () => {
    render(<DashboardHome token="test-token" invoices={mockInvoices} />);

    // Wait for the stats to appear (signals loading is done)
    await screen.findByText('Total Medicines');
    
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
    expect(screen.getByText('₹15,000')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
  });

  it('navigates to invoices when View All is clicked', async () => {
    const setView = vi.fn();
    render(<DashboardHome token="test-token" invoices={mockInvoices} setView={setView} />);

    await screen.findByText('View All');
    fireEvent.click(screen.getByText('View All'));
    expect(setView).toHaveBeenCalledWith('invoices');
  });

  it('navigates to suppliers when Manage Suppliers is clicked', async () => {
    const setView = vi.fn();
    render(<DashboardHome token="test-token" invoices={mockInvoices} setView={setView} />);

    await screen.findByText('Manage Suppliers');
    fireEvent.click(screen.getByText('Manage Suppliers'));
    expect(setView).toHaveBeenCalledWith('suppliers');
  });

  it('handles empty invoices list', async () => {
    render(<DashboardHome token="test-token" invoices={[]} />);
    await screen.findByText('No recent invoices.');
  });

  it('handles fetch error', async () => {
    console.error = vi.fn();
    global.fetch.mockImplementationOnce(() => Promise.reject('API Error'));
    render(<DashboardHome token="test-token" />);
    await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
    });
  });
});
