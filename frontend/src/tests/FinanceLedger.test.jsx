import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinanceLedger from '../views/Finance/FinanceLedger';
import api from '../api';

// Mock the API and PDF libraries
vi.mock('../api', () => ({
  default: {
    getLedger: vi.fn(),
    getLedgerExport: vi.fn()
  }
}));
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    autoTable: vi.fn(),
    lastAutoTable: { finalY: 100 },
    save: vi.fn()
  }))
}));
vi.mock('jspdf-autotable', () => ({ 
  default: vi.fn()
}));

const mockLedgerData = {
  opening_balance: 1000,
  closing_balance: 1500,
  entries: [
    {
      date: '2024-04-25',
      details: 'Pharmacy',
      credit: 600,
      debit: 0,
      credit_gst: 30,
      debit_gst: 0,
      balance: 1600
    },
    {
      date: '2024-04-25',
      details: 'Electricity',
      credit: 0,
      debit: 100,
      credit_gst: 0,
      debit_gst: 0,
      balance: 1500
    }
  ],
  start_date: '2024-04-01',
  end_date: '2024-04-30'
};

describe('FinanceLedger Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLedger.mockResolvedValue(mockLedgerData);
  });

  it('renders ledger title and summary cards', async () => {
    render(<FinanceLedger token="test-token" onUnauthorized={() => {}} />);
    
    expect(screen.getByText(/Accounting Ledger/i)).toBeInTheDocument();
    
    // Use findByText to wait for the data to load
    await screen.findByText(/Pharmacy/i);
    await screen.findByText(/Electricity/i);
  });

  it('displays opening balance row and entries in the table', async () => {
    render(<FinanceLedger token="test-token" onUnauthorized={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Opening Balance Brought Forward/i)).toBeInTheDocument();
      expect(screen.getByText(/Pharmacy/i)).toBeInTheDocument();
      expect(screen.getByText(/Electricity/i)).toBeInTheDocument();
      
      // Check for formatted dates
      // The opening balance row uses filters.from_date (default is 30 days ago)
      // The entries use the dates from mockLedgerData ('2024-04-25')
      expect(screen.getAllByText('25-04-2024')).toHaveLength(2); // Two entries on the same day
    });
  });

  it('calls API when date filters change', async () => {
    const { container } = render(<FinanceLedger token="test-token" onUnauthorized={() => {}} />);
    
    // Find the first date input (From Date)
    const fromInput = container.querySelector('input[type="date"]');
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
    
    await waitFor(() => {
      expect(api.getLedger).toHaveBeenCalledWith("test-token", "2024-01-01", expect.any(String));
    });
  });

  it('handles Excel export', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    api.getLedgerExport.mockResolvedValue(mockBlob);
    
    // Mock URL.createObjectURL and click
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob-url');
    
    render(<FinanceLedger token="test-token" onUnauthorized={() => {}} />);
    
    const excelBtn = screen.getByTitle(/Export to Excel/i);
    fireEvent.click(excelBtn);
    
    await waitFor(() => {
      expect(api.getLedgerExport).toHaveBeenCalled();
    });
  });
});
