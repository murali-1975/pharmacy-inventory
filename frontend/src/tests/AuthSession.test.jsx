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

describe('Session Timeout Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock setup to prevent early crashes in App lifecycle
    api.getSuppliers.mockResolvedValue([]);
    api.getMedicines.mockResolvedValue([]);
    api.getManufacturers.mockResolvedValue([]);
    api.getInvoices.mockResolvedValue({ items: [], total: 0 });
    api.getStatuses.mockResolvedValue([]);
    api.getSupplierTypes.mockResolvedValue([]);

    // Mock global fetch for analytics endpoints or other direct calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
  });

  it('clears token and redirects to login when session expires', async () => {
    // 1. Simulate an existing session
    localStorage.setItem('token', 'mock-expired-token');
    
    // 2. Mock the identity call to fail with 401 Unauthorized
    api.getMe.mockRejectedValue(new Error('Unauthorized'));

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    // 3. Verify that the token is eventually cleared from localStorage
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
    }, { timeout: 3000 });

    // 4. Verify the "Session Expired" visual alert is displayed on the Login screen
    const expiredMsg = await screen.findByText(/Your session has expired/i);
    expect(expiredMsg).toBeInTheDocument();
    
    // 5. Ensure the user sees the Login title
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it('keeps the user logged in if the token is valid', async () => {
    localStorage.setItem('token', 'valid-token');
    api.getMe.mockResolvedValue({ id: 1, username: 'admin', role: 'Admin' });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    // Should NOT show login screen
    await waitFor(() => {
      expect(screen.queryByText(/Welcome back/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show the App Header/Sidebar (Omniflow is at the top)
    await waitFor(() => {
      const brand = screen.queryByText(/Omniflow/i);
      expect(brand).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
