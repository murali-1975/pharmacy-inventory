import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ManufacturersView from '../views/ManufacturersView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('ManufacturersView Component', () => {
  const mockManufacturers = [
    { id: 1, name: 'Micro Labs', contact_person: 'John Doe', phone_number: '1234567890', address: 'Bangalore', is_active: true },
    { id: 2, name: 'Cipla', contact_person: 'Jane Smith', phone_number: '0987654321', address: 'Mumbai', is_active: false }
  ];

  const mockProps = {
    manufacturers: mockManufacturers,
    onAddClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    currentUser: { role: 'Admin' }
  };

  it('renders correctly with manufacturers', () => {
    render(
      <TestWrapper>
        <ManufacturersView {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Micro Labs')).toBeInTheDocument();
    expect(screen.getByText('Cipla')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('filters manufacturers by search term', () => {
    render(
      <TestWrapper>
        <ManufacturersView {...mockProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search manufacturers/i);
    fireEvent.change(searchInput, { target: { value: 'cipla' } });

    expect(screen.getByText('Cipla')).toBeInTheDocument();
    expect(screen.queryByText('Micro Labs')).not.toBeInTheDocument();
  });

  it('calls onAddClick, onEditClick, and onDeleteClick', () => {
    render(
      <TestWrapper>
        <ManufacturersView {...mockProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Add Manufacturer/i));
    expect(mockProps.onAddClick).toHaveBeenCalled();

    const editButtons = screen.getAllByTitle('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockProps.onEditClick).toHaveBeenCalledWith(mockManufacturers[0]);

    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(mockProps.onDeleteClick).toHaveBeenCalledWith(mockManufacturers[0].id);
  });

  it('hides management buttons for non-admins', () => {
    render(
      <TestWrapper>
        <ManufacturersView {...mockProps} currentUser={{ role: 'Staff' }} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Add Manufacturer/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
