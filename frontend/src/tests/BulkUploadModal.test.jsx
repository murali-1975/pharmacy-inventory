import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import BulkUploadModal from '../components/invoices/BulkUploadModal';
import { TestWrapper } from './helpers/TestWrapper';
import api from '../api';

// Mock the API
vi.mock('../api', () => ({
  default: {
    uploadInvoices: vi.fn(),
    getInvoiceTemplate: vi.fn(),
    getInvoiceTemplateUrl: vi.fn()
  }
}));

describe('BulkUploadModal Component', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onRefresh: vi.fn(),
    token: 'test-token'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(
      <TestWrapper>
        <BulkUploadModal {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Bulk Invoice Upload/i)).toBeInTheDocument();
  });

  it('calls API and shows results on success', async () => {
    const mockResponse = { success_count: 3, error_count: 1, error_csv_content: 'error' };
    api.uploadInvoices.mockResolvedValue(mockResponse);

    const { container } = render(
      <TestWrapper>
        <BulkUploadModal {...defaultProps} />
      </TestWrapper>
    );

    const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
    const input = container.querySelector('#fileInput');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    const uploadBtn = screen.getByRole('button', { name: /Start Import/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText(/Import Complete/i)).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument(); // success count
    expect(screen.getByText('1')).toBeInTheDocument(); // error count
    expect(screen.getByText(/Download Error Report/i)).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    api.uploadInvoices.mockRejectedValue(new Error('Upload failed'));

    const { container } = render(
      <TestWrapper>
        <BulkUploadModal {...defaultProps} />
      </TestWrapper>
    );

    const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
    const input = container.querySelector('#fileInput');
    fireEvent.change(input, { target: { files: [file] } });
    
    fireEvent.click(screen.getByRole('button', { name: /Start Import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });
});
