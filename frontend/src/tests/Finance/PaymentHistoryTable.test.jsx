import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PaymentHistoryTable from '../../views/Finance/PaymentHistoryTable';
import api from '../../api';

// Mock the API and icons
vi.mock('../../api');
vi.mock('lucide-react', () => ({
  History: () => <div>HistoryIcon</div>,
  Plus: () => <div>PlusIcon</div>,
  Search: () => <div>SearchIcon</div>,
  Activity: () => <div>ActivityIcon</div>,
  Filter: () => <div>FilterIcon</div>,
  Eye: () => <div>EyeIcon</div>,
  AlertCircle: () => <div>AlertIcon</div>,
  Edit2: () => <div>EditIcon</div>,
  Trash2: () => <div>TrashIcon</div>,
  ChevronLeft: () => <div>LeftIcon</div>,
  ChevronRight: () => <div>RightIcon</div>,
  Calendar: () => <div>CalendarIcon</div>,
  RefreshCcw: () => <div>RefreshIcon</div>,
  FileText: () => <div>FileTextIcon</div>,
  Download: () => <div>DownloadIcon</div>
}));

const mockPayments = {
  total: 1,
  items: [
    {
      id: 1,
      patient_name: "Test Patient",
      payment_date: "2026-04-25",
      total_amount: 1000,
      token_no: "T101"
    }
  ]
};

describe('PaymentHistoryTable Soft Delete', () => {
  it('should show delete button for Admin and trigger delete', async () => {
    const mockToken = 'test-token';
    const mockUser = { role: 'Admin' };
    api.getPatientPayments.mockResolvedValue(mockPayments);
    api.deletePatientPayment.mockResolvedValue({ success: true });

    render(
      <PaymentHistoryTable 
        token={mockToken} 
        currentUser={mockUser}
        onEdit={() => {}}
        onView={() => {}}
        onAdd={() => {}}
      />
    );

    // Wait for data to load
    await waitFor(() => expect(screen.getByText('Test Patient')).toBeInTheDocument());

    // Check if Trash icon (Delete button) is present
    const deleteBtn = screen.getByTestId('delete-payment-1');
    expect(deleteBtn).toBeInTheDocument();

    // Click delete
    fireEvent.click(deleteBtn);

    // Should show confirmation (mocking window.confirm or checking for modal text)
    // For this test, let's assume we use a confirmation text in UI
    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByText(/^Delete$/i);
    fireEvent.click(confirmBtn);

    expect(api.deletePatientPayment).toHaveBeenCalledWith(mockToken, 1);
  });

  it('should hide delete button for Staff', async () => {
    const mockUser = { role: 'Staff' };
    api.getPatientPayments.mockResolvedValue(mockPayments);

    render(
      <PaymentHistoryTable 
        token="token" 
        currentUser={mockUser}
        onEdit={() => {}}
        onView={() => {}}
        onAdd={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Test Patient')).toBeInTheDocument());

    // Trash icon should NOT be present
    expect(screen.queryByTestId('delete-payment-1')).not.toBeInTheDocument();
  });
});
