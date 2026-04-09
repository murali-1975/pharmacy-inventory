import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import App from '../App.jsx';
import { api } from '../api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  };
  return {
    api: mockApi,
    default: mockApi
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mocks
    api.getSuppliers.mockResolvedValue([]);
    api.getMedicines.mockResolvedValue([]);
    api.getManufacturers.mockResolvedValue([]);
    api.getInvoices.mockResolvedValue({ items: [], total: 0 });
    api.getStatuses.mockResolvedValue([]);
    api.getSupplierTypes.mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_medicines: 10,
        pending_invoices_amount: 5000,
        monthly_procurement: 1200,
        low_stock_alerts: 2
      })
    });
  });

  it('renders the welcome message or dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    // Should show Omniflow (Login screen since no token)
    await waitFor(() => {
      // Use getAllByText and pick the first one (heading) to avoid ambiguity with footer
      expect(screen.getAllByText(/Omniflow/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders dashboard when logged in', async () => {
    localStorage.setItem('token', 'real-token');
    api.getMe.mockResolvedValue({ username: 'admin', role: 'Admin' });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    // Should show Dashboard (Omniflow Sidebar text + Welcome/Sign Out)
    await waitFor(() => {
        expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
