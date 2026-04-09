import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import PaymentForm from '../components/invoices/PaymentForm';
import { TestWrapper } from './helpers/TestWrapper';

describe('PaymentForm Component', () => {
  const defaultProps = {
    invoice: {
      id: 1,
      reference_number: 'INV-001',
      total_value: 1000,
      payments: [
        { paid_amount: 400, payment_date: '2026-04-01', payment_mode: 'Cash' }
      ],
      status: 'Pending'
    },
    onSave: vi.fn(),
    onClose: vi.fn()
  };

  it('renders correctly with invoice details', () => {
    render(
      <TestWrapper>
        <PaymentForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: /Record Payment/i })).toBeInTheDocument();
    expect(screen.getByText(/INV-001/i)).toBeInTheDocument();
    expect(screen.getByText(/600/i)).toBeInTheDocument(); // Balance: 1000 - 400
  });

  it('calls onSave with payment amount when submitted', async () => {
    render(
      <TestWrapper>
        <PaymentForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText(/Paid Amount/i), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/Remarks/i), { target: { value: 'Partial payment' } });

    const submitBtn = screen.getByRole('button', { name: /^Record Payment$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(1, expect.objectContaining({
        paid_amount: 200,
        remarks: 'Partial payment'
      }));
    });
  });
});
