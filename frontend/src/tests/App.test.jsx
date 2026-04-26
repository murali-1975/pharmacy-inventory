import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import App from '../App.jsx';
import { api } from '../api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureProvider } from '../context/FeatureContext.jsx';

// Centralized API Mock
vi.mock('../api', () => {
  const mockApi = {
    getMe: vi.fn(),
    getSuppliers: vi.fn(),
    saveSupplier: vi.fn(),
    deleteSupplier: vi.fn(),
    getMedicines: vi.fn(),
    saveMedicine: vi.fn(),
    deleteMedicine: vi.fn(),
    getManufacturers: vi.fn(),
    saveManufacturer: vi.fn(),
    deleteManufacturer: vi.fn(),
    getInvoices: vi.fn(),
    saveInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
    addInvoicePayment: vi.fn(),
    getInvoicePayments: vi.fn(),
    getStatuses: vi.fn(),
    saveStatus: vi.fn(),
    deleteStatus: vi.fn(),
    getSupplierTypes: vi.fn(),
    saveSupplierType: vi.fn(),
    deleteSupplierType: vi.fn(),
    getUsers: vi.fn(),
    saveUser: vi.fn(),
    deleteUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getDispensingPrice: vi.fn(),
    uploadDispensing: vi.fn(),
    getDispensingTemplate: vi.fn(),
    uploadInvoices: vi.fn(),
    getInvoiceTemplate: vi.fn(),
    getFinancialReport: vi.fn(),
    getProfitMarginReport: vi.fn(),
    getInventoryValuation: vi.fn(),
    getSupplierAging: vi.fn(),
    getGstReconciliation: vi.fn(),
    getStock: vi.fn(),
    getStockAdjustments: vi.fn(),
    getFinanceMasters: vi.fn(),
    getExpenses: vi.fn(),
    deleteExpense: vi.fn(),
    saveExpense: vi.fn(),
  };
  return {
    api: mockApi,
    default: mockApi
  };
});

let queryClient;

describe('App Component', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock response
    api.getSuppliers.mockResolvedValue([]);
    api.getMedicines.mockResolvedValue([]);
    api.getManufacturers.mockResolvedValue([]);
    api.getInvoices.mockResolvedValue({ items: [], total: 0 });
    api.getStatuses.mockResolvedValue([]);
    api.getSupplierTypes.mockResolvedValue([]);
    api.getFinancialReport.mockResolvedValue([]);
    api.getProfitMarginReport.mockResolvedValue([]);
    api.getInventoryValuation.mockResolvedValue([]);
    api.getSupplierAging.mockResolvedValue([]);
    api.getGstReconciliation.mockResolvedValue([]);
    api.getStock.mockResolvedValue({ items: [], total: 0 });
    api.getFinanceMasters.mockResolvedValue({ expense_types: [], payment_modes: [] });
    api.getExpenses.mockResolvedValue({ items: [], total: 0 });
    
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/config/features') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ features: [
            'FINANCE_MANAGEMENT', 
            'INVOICE_MANAGEMENT', 
            'STOCK_MANAGEMENT', 
            'DISPENSING_MANAGEMENT',
            'SUPPLIER_MANAGEMENT'
          ] })
        });
      }
      if (url.includes('/api/stock/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [], total: 0 })
        });
      }
      if (url.includes('/api/financials/')) {
        return Promise.resolve({
          ok: true,
          json: async () => {
             if (url.includes('aging') || url.includes('profit')) return [];
             return {};
          }
        });
      }
      // Default to analytics stats or generic objects
      return Promise.resolve({
        ok: true,
        json: async () => ({
          total_medicines: 10,
          pending_invoices_amount: 5000,
          monthly_procurement: 1200,
          low_stock_alerts: 2
        })
      });
    });
  });

  it('renders login screen when not authenticated', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FeatureProvider>
          <App />
        </FeatureProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
  });

  it('navigates through views after login', async () => {
    localStorage.setItem('token', 'real-token');
    api.getMe.mockResolvedValue({ username: 'admin', role: 'Admin' });

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureProvider>
          <App />
        </FeatureProvider>
      </QueryClientProvider>
    );

    // Sidebar should be present
    await screen.findByText(/Sign Out/i);

    // Wait for user info to load (ensures Admin role is recognized)
    await waitFor(() => {
      expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
    });

    // Dashboard is default - wait for content to load
    await screen.findByText(/Total Medicines/i);

    // Navigate to Suppliers
    fireEvent.click(screen.getAllByText('Suppliers').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 1, name: /Supplier Directory/i });

    // Navigate to Invoices
    fireEvent.click(screen.getAllByText('Invoices').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 1, name: /Purchase Invoices/i });

    // Navigate to Dispensing
    fireEvent.click(screen.getAllByText('Dispensing').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 2, name: /Medicine Dispensing/i });

    // Navigate to Stock
    fireEvent.click(screen.getAllByText('Stock Inventory').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 2, name: /Stock Management/i });

    // Navigate to Financials
    fireEvent.click(screen.getAllByText('Financial Reports').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 1, name: /Financial Reports/i });

    // Navigate to Admin
    fireEvent.click(screen.getAllByText('Admin Hub').find(el => el.tagName === 'SPAN'));
    await screen.findByRole('heading', { level: 1, name: /Administrative Hub/i });

    const paymentHistory = await screen.findByText(/Payment History/i);
    expect(paymentHistory).toBeDefined();

    // Navigate to Expense History
    const expHistoryLink = screen.getByText(/Expense History/i);
    fireEvent.click(expHistoryLink);
    const expHistoryTitle = await screen.findByText(/Audit and manage past operational outflows/i);
    expect(expHistoryTitle).toBeDefined();

    // Logout
    fireEvent.click(screen.getByText(/Sign Out/i));
    await screen.findByText(/Welcome back/i, {}, { timeout: 3000 });
  });
});
