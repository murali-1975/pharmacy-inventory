import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ManufacturerForm from '../components/manufacturers/ManufacturerForm';
import { TestWrapper } from './helpers/TestWrapper';

describe('ManufacturerForm Component', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    initialData: null
  };

  it('renders correctly', () => {
    render(
      <TestWrapper>
        <ManufacturerForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/Manufacturer Name/i)).toBeInTheDocument();
  });

  it('calls onSave with form data when submitted', async () => {
    render(
      <TestWrapper>
        <ManufacturerForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText(/Manufacturer Name/i), { target: { value: 'New Test Lab' } });
    fireEvent.change(screen.getByLabelText(/Contact Person/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '1234567890' } });

    const submitBtn = screen.getByRole('button', { name: /Add Manufacturer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Test Lab',
        contact_person: 'John Doe'
      }));
    });
  });

  it('populates with initialData', () => {
    const initialData = {
      id: 1,
      name: 'Existing Lab',
      contact_person: 'Jane Smith',
      phone_number: '9876543210',
      is_active: true
    };
    render(
      <TestWrapper>
        <ManufacturerForm {...defaultProps} initialData={initialData} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/Manufacturer Name/i).value).toBe('Existing Lab');
    expect(screen.getByLabelText(/Contact Person/i).value).toBe('Jane Smith');
  });
});
