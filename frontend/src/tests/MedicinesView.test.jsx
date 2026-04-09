import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import MedicinesView from '../views/MedicinesView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('MedicinesView Component', () => {
  const mockMedicines = [
    {
      id: 1,
      product_name: 'Dolo 650',
      generic_name: 'Paracetamol',
      manufacturer: { name: 'Micro Labs' },
      category: 'Tablet',
      hsn_code: '300490',
      storage_type: 'Cool',
      uom: 'Strip',
      unit_price: 30.0
    },
    {
        id: 2,
        product_name: 'Augmentin',
        generic_name: 'Amoxicillin',
        manufacturer: { name: 'GSK' },
        category: 'Capsule',
        hsn_code: '300491',
        storage_type: 'Room',
        uom: 'Bottle',
        unit_price: 150.0
      }
  ];

  const defaultProps = {
    medicines: mockMedicines,
    onAddClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn(),
    currentUser: { role: 'Admin' }
  };

  it('renders the medicine list correctly', () => {
    render(
      <TestWrapper>
        <MedicinesView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Dolo 650')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Micro Labs')).toBeInTheDocument();
    expect(screen.getByText('₹30.00')).toBeInTheDocument();
  });

  it('filters medicines by brand name', () => {
    render(
      <TestWrapper>
        <MedicinesView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by brand/i);
    fireEvent.change(searchInput, { target: { value: 'Augmentin' } });

    expect(screen.getByText('Augmentin')).toBeInTheDocument();
    expect(screen.queryByText('Dolo 650')).not.toBeInTheDocument();
  });

  it('filters medicines by HSN code', () => {
    render(
      <TestWrapper>
        <MedicinesView {...defaultProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search by brand/i);
    fireEvent.change(searchInput, { target: { value: '300491' } });

    expect(screen.getByText('Augmentin')).toBeInTheDocument();
    expect(screen.queryByText('Dolo 650')).not.toBeInTheDocument();
  });

  it('calls onAddClick when button is clicked', () => {
    render(
      <TestWrapper>
        <MedicinesView {...defaultProps} />
      </TestWrapper>
    );

    const addBtn = screen.getByText(/Add to Master/i);
    fireEvent.click(addBtn);
    expect(defaultProps.onAddClick).toHaveBeenCalled();
  });

  it('hides Add button for non-admin users', () => {
    render(
      <TestWrapper>
        <MedicinesView {...defaultProps} currentUser={{ role: 'Staff' }} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Add to Master/i)).not.toBeInTheDocument();
  });
});
