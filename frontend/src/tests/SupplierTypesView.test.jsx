import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import SupplierTypesView from '../views/SupplierTypesView';
import { TestWrapper } from './helpers/TestWrapper';

describe('SupplierTypesView Component', () => {
  const mockTypes = [
    { id: 1, name: 'Wholesale', is_active: true },
    { id: 2, name: 'Retail', is_active: false }
  ];

  const defaultProps = {
    types: mockTypes,
    onSave: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and loads types', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Wholesale')).toBeInTheDocument();
    expect(screen.getByText('Retail')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('filters types based on search term', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search supplier types/i);
    fireEvent.change(searchInput, { target: { value: 'Whole' } });

    expect(screen.getByText('Wholesale')).toBeInTheDocument();
    expect(screen.queryByText('Retail')).not.toBeInTheDocument();
  });

  it('calls onSave when add button is clicked', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/New type name/i);
    fireEvent.change(input, { target: { value: 'Distributor' } });
    
    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith({ name: 'Distributor' }, null);
  });

  it('shows error when adding duplicate type', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/New type name/i);
    fireEvent.change(input, { target: { value: 'Wholesale' } });
    
    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/This type already exists/i)).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('enters edit mode and saves changes', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    // Click edit button for first row
    const editBtns = screen.getAllByRole('button', { name: /edit-type/i });
    fireEvent.click(editBtns[0]);

    const editInput = screen.getByDisplayValue('Wholesale');
    fireEvent.change(editInput, { target: { value: 'Wholesale updated' } });

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith({ name: 'Wholesale updated' }, 1);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(
      <TestWrapper>
        <SupplierTypesView {...defaultProps} />
      </TestWrapper>
    );

    const deleteBtns = screen.getAllByRole('button', { name: /delete-type/i });
    fireEvent.click(deleteBtns[0]);

    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });
});
