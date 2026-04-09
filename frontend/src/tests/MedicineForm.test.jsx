import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import MedicineForm from '../components/medicines/MedicineForm.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('MedicineForm Component', () => {
  const mockManufacturers = [
    { id: 1, name: 'Micro Labs' },
    { id: 2, name: 'Cipla' }
  ];

  const defaultProps = {
    manufacturers: mockManufacturers,
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  it('renders correctly with default values', () => {
    render(
      <TestWrapper>
        <MedicineForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText(/Crocin 650/i)).toBeInTheDocument();
    expect(screen.getByText(/Add to Master/i)).toBeInTheDocument();
  });

  it('renders with initial data for editing', () => {
    const initialData = {
      product_name: 'Dolo 650',
      generic_name: 'Paracetamol',
      manufacturer_id: 1,
      hsn_code: '300490',
      category: 'GENERAL',
      uom: 'Strip',
      storage_type: 'Ambient',
      unit_price: 30,
      selling_price_percent: 10
    };

    render(
      <TestWrapper>
        <MedicineForm {...defaultProps} initialData={initialData} />
      </TestWrapper>
    );

    expect(screen.getByDisplayValue('Dolo 650')).toBeInTheDocument();
    expect(screen.getByText('Update Medicine')).toBeInTheDocument();
  });

  it('calls onSave with form data when submitted', () => {
    render(
      <TestWrapper>
        <MedicineForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByPlaceholderText(/Crocin 650/i), { target: { value: 'New Medicine' } });
    fireEvent.change(screen.getByPlaceholderText(/Paracetamol/i), { target: { value: 'New Generic' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Manufacturer/i }), { target: { value: '1' } });
    fireEvent.change(screen.getByPlaceholderText(/8-digit code/i), { target: { value: '12345678' } });

    const submitBtn = screen.getByText(/Add to Master/i);
    fireEvent.click(submitBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      product_name: 'New Medicine',
      generic_name: 'New Generic',
      manufacturer_id: 1,
      hsn_code: '12345678'
    }));
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <TestWrapper>
        <MedicineForm {...defaultProps} />
      </TestWrapper>
    );

    const cancelBtn = screen.getByText(/Cancel/i);
    fireEvent.click(cancelBtn);
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
