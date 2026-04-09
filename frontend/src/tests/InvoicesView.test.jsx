import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import InvoicesView from '../views/InvoicesView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('InvoicesView Component', () => {
  const mockInvoices = [
    {
      id: 1,
      reference_number: 'INV-001',
      invoice_date: '2024-03-20T00:00:00Z',
      supplier: { supplier_name: 'Pharma Corp' },
      status: 'Paid',
      total_value: 1500.50,
      gst: 180.0,
      payments: [{ paid_amount: 1500.50 }]
    },
    {
      id: 2,
      reference_number: 'INV-002',
      invoice_date: '2024-03-21T00:00:00Z',
      supplier: { supplier_name: 'Health Inc' },
      status: 'Pending',
      total_value: 2000.0,
      gst: 240.0,
      payments: []
    }
  ];

  const defaultProps = {
    invoices: mockInvoices,
    onAddClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    currentUser: { role: 'Admin' },
    currentPage: 1,
    totalInvoices: 2,
    pageSize: 10,
    onChangePage: vi.fn(),
    onRefresh: vi.fn(),
    onSavePayment: vi.fn(),
    onSearch: vi.fn(),
    onSort: vi.fn(),
    token: 'test-token'
  };

  it('renders the invoice list correctly', () => {
    render(
      <TestWrapper>
        <InvoicesView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('INV-002')).toBeInTheDocument();
    expect(screen.getByText('Pharma Corp')).toBeInTheDocument();
    // Use getAllByText for currency since it may appear in multiple columns
    expect(screen.getAllByText(/₹1,500.5/i)[0]).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls onSearch when typing in the search bar', async () => {
    vi.useFakeTimers();
    render(
      <TestWrapper>
        <InvoicesView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by invoice # or supplier/i);
    fireEvent.change(searchInput, { target: { value: 'INV-001' } });

    // Wait for debounce (300ms)
    vi.advanceTimersByTime(300);
    expect(defaultProps.onSearch).toHaveBeenCalledWith('INV-001');
    vi.useRealTimers();
  });

  it('calls onAddClick when New Invoice button is clicked', () => {
    render(
      <TestWrapper>
        <InvoicesView {...defaultProps} />
      </TestWrapper>
    );

    const addButton = screen.getByText(/New Invoice/i);
    fireEvent.click(addButton);
    expect(defaultProps.onAddClick).toHaveBeenCalled();
  });

  it('renders "No invoices found" when list is empty', () => {
    render(
      <TestWrapper>
        <InvoicesView {...defaultProps} invoices={[]} totalInvoices={0} />
      </TestWrapper>
    );

    expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
  });

  it('displays correct pagination info', () => {
    render(
      <TestWrapper>
        <InvoicesView {...defaultProps} totalInvoices={25} currentPage={2} pageSize={10} />
      </TestWrapper>
    );

    // Use a function matcher because text is split across multiple span tags
    const paginationText = screen.getByText((content, element) => {
      const hasText = (node) => node.textContent === "Showing 11 to 20 of 25 invoices";
      const nodeHasText = hasText(element);
      const childrenDontHaveText = Array.from(element.children).every(
        (child) => !hasText(child)
      );
      return nodeHasText && childrenDontHaveText;
    });
    expect(paginationText).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
  });
});
