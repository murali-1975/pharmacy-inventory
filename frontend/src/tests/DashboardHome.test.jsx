import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DashboardHome from '../views/DashboardHome.jsx';

describe('DashboardHome Component', () => {
  const mockInvoices = [
    { id: 1, reference_number: 'INV-001', invoice_date: '2024-03-20', total_value: 1000, supplier: { supplier_name: 'Alpha Pharma' } },
    { id: 2, reference_number: 'INV-002', invoice_date: '2024-03-21', total_value: 2000, supplier: { supplier_name: 'Beta Meds' } }
  ];

  const mockLowStock = {
    total: 2,
    items: [
      { id: 10, medicine: { product_name: 'Paracetamol', category: 'Analgesics', uom: 'Tablet' }, quantity_on_hand: 5, reorder_level: 10 },
      { id: 11, medicine: { product_name: 'Amoxicillin', category: 'Antibiotics', uom: 'Capsule' }, quantity_on_hand: 2, reorder_level: 20 }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    if (global.URL.createObjectURL) vi.spyOn(global.URL, 'createObjectURL').mockReturnValue('blob:test');
    
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/analytics/stats')) {
        return Promise.resolve({ ok: true, json: async () => mockStats });
      }
      if (url.includes('/api/stock/?low_stock_only=true')) {
        return Promise.resolve({ ok: true, json: async () => mockLowStock });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders loading state initially', async () => {
    render(<DashboardHome token="test-token" />);
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('renders stats, recent invoices, and low stock list after loading', async () => {
    render(<DashboardHome token="test-token" invoices={mockInvoices} />);
    await screen.findByText('Total Medicines');
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
  });

  it('navigates when View All is clicked', async () => {
    const setView = vi.fn();
    render(<DashboardHome token="test-token" invoices={mockInvoices} setView={setView} />);
    await screen.findByText('Recent Invoices');
    fireEvent.click(screen.getAllByText('View All')[0]);
    expect(setView).toHaveBeenCalledWith('invoices');
  });

  it('navigates to stock view from low stock section', async () => {
    const setView = vi.fn();
    render(<DashboardHome token="test-token" invoices={mockInvoices} setView={setView} />);
    await screen.findByText('Low Stock Items');
    const viewAllBtn = screen.getAllByText('View All').find(el => el.closest('#low-stock-section'));
    fireEvent.click(viewAllBtn);
    expect(setView).toHaveBeenCalledWith('stock');
  });

  it('handles CSV export', async () => {
    const link = document.createElement('a');
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(link);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    render(<DashboardHome token="test-token" invoices={mockInvoices} />);
    await screen.findByText('Export CSV');
    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    vi.restoreAllMocks();
  });

  it('handles fetch error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockImplementationOnce(() => Promise.reject(new Error('API Error')));
    render(<DashboardHome token="test-token" />);
    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });
});
