import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PatientPaymentForm from '../views/Finance/PatientPaymentForm';
import api from '../api';

// Mock the api utility
vi.mock('../api', () => ({
  default: {
    getFinanceMasters: vi.fn(),
    savePatientPayment: vi.fn()
  }
}));

const mockMasters = {
  identifiers: [{ id: 1, id_name: 'UHID' }],
  services: [{ id: 10, service_name: 'Consultation' }, { id: 11, service_name: 'Medicine' }],
  payment_modes: [{ id: 100, mode: 'Cash' }, { id: 101, mode: 'UPI' }]
};

describe('PatientPaymentForm Enhanced Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getFinanceMasters.mockResolvedValue(mockMasters);
  });

  it('calculates aggregate total in Step 2 based on service amounts', async () => {
    render(<PatientPaymentForm token="fake-token" />);
    
    // Step 1: Patient Name
    fireEvent.change(screen.getByPlaceholderText(/Full name/i), { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 2: Add Services
    await screen.findByText(/Select Services Rendered/i);
    
    // First service (Consultation)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '10' } });
    const amountInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(amountInputs[0], { target: { value: '400' } });

    // Add another service
    fireEvent.click(screen.getByText(/Add Service/i));
    const newSelects = screen.getAllByRole('combobox');
    fireEvent.change(newSelects[1], { target: { value: '11' } });
    const newAmountInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(newAmountInputs[1], { target: { value: '1000' } });

    // Check subtotal
    expect(screen.getByText(/Subtotal Amount/i).parentElement).toHaveTextContent('1,400');
  });

  it('validates payment imbalance in Step 3', async () => {
    render(<PatientPaymentForm token="fake-token" />);
    
    // Skip to Step 3 with 1400 total
    fireEvent.change(screen.getByPlaceholderText(/Full name/i), { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByText(/Continue/i));
    
    await screen.findByText(/Select Services Rendered/i);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1400' } });
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 3: Payment Breakdown
    await screen.findByText(/Payment Breakdown/i);
    
    // Change payment to 1000 (Mismatch with 1400)
    const paymentInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(paymentInputs[0], { target: { value: '1000' } });
    
    fireEvent.click(screen.getByText(/Confirm & Save/i));
    
    expect(await screen.findByText(/Payment imbalance/i)).toBeInTheDocument();
    expect(api.savePatientPayment).not.toHaveBeenCalled();
  });

  it('submits successfully with split payments', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/Full name/i), { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByText(/Continue/i));
    
    // Step 2 (Rs 1400)
    await screen.findByText(/Select Services Rendered/i);
    const sSelects = screen.getAllByRole('combobox');
    fireEvent.change(sSelects[0], { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1400' } });
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 3: Split into 700 Cash + 700 UPI
    await screen.findByText(/Payment Breakdown/i);
    
    // 700 Cash
    const pSelects = screen.getAllByRole('combobox');
    fireEvent.change(pSelects[0], { target: { value: '100' } });
    const pInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(pInputs[0], { target: { value: '700' } });

    // Add UPI 700
    fireEvent.click(screen.getByText(/Add Mode/i));
    const finalSelects = screen.getAllByRole('combobox');
    fireEvent.change(finalSelects[1], { target: { value: '101' } });
    const finalInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(finalInputs[1], { target: { value: '700' } });

    fireEvent.click(screen.getByText(/Confirm & Save/i));

    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({
          total_amount: 1400,
          payments: expect.arrayContaining([
            expect.objectContaining({ payment_mode_id: 100, value: 700 }),
            expect.objectContaining({ payment_mode_id: 101, value: 700 })
          ])
        })
      );
    });
  });

  it('allows saving Free / Charity visits without payment modes', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/Full name/i), { target: { value: 'Fathima' } });
    fireEvent.click(screen.getByText(/Continue/i));
    
    // Step 2 (Rs 400)
    await screen.findByText(/Select Services Rendered/i);
    const sSelects = screen.getAllByRole('combobox');
    fireEvent.change(sSelects[0], { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '400' } });
    fireEvent.click(screen.getByText(/Continue/i));

    // Step 3
    await screen.findByText(/Payment Breakdown/i);
    
    // Check Free checkbox
    const freeCheckbox = screen.getByLabelText(/Free \/ Charity/i);
    fireEvent.click(freeCheckbox);
    
    // Mode is still "Select Mode..." (empty), but should pass because of free_flag
    fireEvent.click(screen.getByText(/Confirm & Save/i));

    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({
          patient_name: 'Fathima',
          free_flag: true,
          payments: []
        })
      );
    });
    expect(screen.getByText(/Payment Recorded!/i)).toBeInTheDocument();
  });
});
