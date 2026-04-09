import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import SuppliersView from '../views/SuppliersView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('SuppliersView Component', () => {
  const mockSuppliers = [
    {
      id: 1,
      supplier_name: 'Pharma Dist',
      type: { name: 'Wholesaler' },
      contact_details: { contact_name: 'John Doe', email_id: 'john@pharma.com' },
      status: { name: 'Active' }
    },
    {
      id: 2,
      supplier_name: 'Medihub',
      type: { name: 'Manufacturer' },
      contact_details: { contact_name: 'Jane Smith', email_id: 'jane@medihub.com' },
      status: { name: 'Inactive' }
    }
  ];

  const defaultProps = {
    suppliers: mockSuppliers,
    statuses: [{ name: 'Active' }, { name: 'Inactive' }],
    types: [{ name: 'Wholesaler' }, { name: 'Manufacturer' }],
    onAddClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    currentUser: { role: 'Admin' }
  };

  it('renders the supplier list correctly', () => {
    render(
      <TestWrapper>
        <SuppliersView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Pharma Dist')).toBeInTheDocument();
    expect(screen.getByText('Wholesaler')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('filters suppliers by name', () => {
    render(
      <TestWrapper>
        <SuppliersView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search suppliers by name/i);
    fireEvent.change(searchInput, { target: { value: 'Medihub' } });

    expect(screen.getByText('Medihub')).toBeInTheDocument();
    expect(screen.queryByText('Pharma Dist')).not.toBeInTheDocument();
  });

  it('calls onEditClick when edit button is clicked', () => {
    render(
      <TestWrapper>
        <SuppliersView {...defaultProps} />
      </TestWrapper>
    );

    const editBtns = screen.getAllByTitle(/Edit Details/i);
    fireEvent.click(editBtns[0]);
    expect(defaultProps.onEditClick).toHaveBeenCalledWith(mockSuppliers[0]);
  });

  it('hides Add button for staff users', () => {
    render(
      <TestWrapper>
        <SuppliersView {...defaultProps} currentUser={{ role: 'Staff' }} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Add Supplier/i)).not.toBeInTheDocument();
  });
});
