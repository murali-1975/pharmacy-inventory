import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentHistoryTable from '../../views/Finance/PaymentHistoryTable';
import api from '../../api';

// Mock the API
vi.mock('../../api');

// Mock URL.createObjectURL and revokeObjectURL
window.URL.createObjectURL = vi.fn(() => 'mock-url');
window.URL.revokeObjectURL = vi.fn();

const mockMasters = { identifiers: [], services: [], payment_modes: [] };
const mockUser = { role: 'Admin' };

describe('PaymentHistoryTable Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger Excel export with current filters', async () => {
    const mockPayments = { total: 0, items: [] };
    api.getPatientPayments.mockResolvedValue(mockPayments);
    const mockBlob = new Blob(['test content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    api.exportPatientPayments.mockResolvedValue(mockBlob);

    render(
      <PaymentHistoryTable 
        token="test-token" 
        currentUser={mockUser}
        masters={mockMasters}
        onEdit={() => {}}
        onView={() => {}}
        onAdd={() => {}}
      />
    );

    // Wait for initial load
    await waitFor(() => expect(api.getPatientPayments).toHaveBeenCalled());

    // Find and click Export Excel button
    const exportBtn = screen.getByText(/Export Excel/i);
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    // Verify loading state
    expect(screen.getByText(/Exporting.../i)).toBeInTheDocument();

    // Verify API call
    await waitFor(() => {
      expect(api.exportPatientPayments).toHaveBeenCalledWith(
        'test-token',
        '', // searchTerm
        '', // singleDate
        '', // fromDate
        ''  // toDate
      );
    });

    // Verify download trigger (checking if createObjectURL was called)
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });
});
