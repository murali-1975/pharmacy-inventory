import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import SupplierForm from '../components/suppliers/SupplierForm.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('SupplierForm Component', () => {
  const mockStatuses = [
    { id: 1, name: 'Active' },
    { id: 2, name: 'Inactive' }
  ];
  const mockTypes = [
    { id: 1, name: 'Wholesaler' },
    { id: 2, name: 'Manufacturer' }
  ];

  const defaultProps = {
    statuses: mockStatuses,
    types: mockTypes,
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  it('renders correctly with default values', () => {
    render(
      <TestWrapper>
        <SupplierForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText(/Legal company name/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Supplier/i)).toBeInTheDocument();
  });

  it('renders with initial data for editing', () => {
    const initialData = {
      id: 1,
      supplier_name: 'Pharma Dist',
      type_id: 1,
      status_id: 1,
      contact_details: {
        contact_name: 'John Doe',
        email_id: 'john@pharma.com',
        phone_number: '1234567890'
      }
    };

    render(
      <TestWrapper>
        <SupplierForm {...defaultProps} initialData={initialData} />
      </TestWrapper>
    );

    expect(screen.getByDisplayValue('Pharma Dist')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Update Supplier')).toBeInTheDocument();
  });

  it('updates contact details fields', () => {
    render(
      <TestWrapper>
        <SupplierForm {...defaultProps} />
      </TestWrapper>
    );

    const contactInput = screen.getByPlaceholderText(/John Doe/i);
    fireEvent.change(contactInput, { target: { value: 'New Contact' } });
    
    expect(contactInput.value).toBe('New Contact');
  });

  it('calls onSave with form data when submitted', () => {
    render(
      <TestWrapper>
        <SupplierForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByPlaceholderText(/Legal company name/i), { target: { value: 'New Supplier' } });
    
    const submitBtn = screen.getByText(/Create Supplier/i);
    fireEvent.click(submitBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      supplier_name: 'New Supplier'
    }));
  });

  it('updates various fields', async () => {
    render(
      <TestWrapper>
        <SupplierForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByPlaceholderText(/City/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByPlaceholderText(/Account Number/i), { target: { value: '12345' } });
    
    expect(screen.getByPlaceholderText(/City/i).value).toBe('Mumbai');
    expect(screen.getByPlaceholderText(/Account Number/i).value).toBe('12345');
  });
});
