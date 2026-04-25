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

describe('PatientPaymentForm Unified Single-Page Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getFinanceMasters.mockResolvedValue(mockMasters);
  });

  it('calculates aggregate total based on service amounts in real-time', async () => {
    render(<PatientPaymentForm token="fake-token" />);
    
    // Patient Name
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'John Doe' } });

    // Add Services
    await screen.findByText(/Services Rendered/i);
    
    // First service (Consultation)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '10' } }); // selects[0] is identifier type, [1] is service type
    const amountInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(amountInputs[0], { target: { value: '400' } });

    // Add another service
    fireEvent.click(screen.getByText(/Add Service/i));
    const newSelects = screen.getAllByRole('combobox');
    fireEvent.change(newSelects[2], { target: { value: '11' } });
    const newAmountInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(newAmountInputs[1], { target: { value: '1000' } });

    // Check total bill in the summary section
    const totalBillSection = screen.getByText(/Total Bill/i).parentElement;
    expect(totalBillSection).toHaveTextContent('1,400');
  });

  it('validates overpayment on submission', async () => {
    render(<PatientPaymentForm token="fake-token" />);
    
    // Fill required details
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'John Doe' } });
    
    await screen.findByText(/Services Rendered/i);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '10' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '1400' } });

    // Settlement section
    const paymentInputs = screen.getAllByPlaceholderText('0.00');
    // Simulate Overpayment (1500 > 1400)
    fireEvent.change(paymentInputs[1], { target: { value: '1500' } }); 
    
    fireEvent.click(screen.getByText(/Confirm & Save/i));
    
    expect(await screen.findByText(/Overpayment/i)).toBeInTheDocument();
    expect(api.savePatientPayment).not.toHaveBeenCalled();
  });

  it('allows partial payment on submission', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'Jane Doe' } });
    await screen.findByText(/Services Rendered/i);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '10' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '1000' } });

    // Pay only 400
    const paymentInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(paymentInputs[1], { target: { value: '400' } });
    
    // Select a mode (very important, I added validation for this)
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '100' } });

    fireEvent.click(screen.getByText(/Confirm & Save/i));
    
    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalled();
    });
  });

  it('submits successfully with split payments', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    // Name
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'John Doe' } });
    
    // Services (Rs 1400)
    await screen.findByText(/Services Rendered/i);
    const sSelects = screen.getAllByRole('combobox');
    fireEvent.change(sSelects[1], { target: { value: '10' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '1400' } });

    // Split into 700 Cash + 700 UPI
    // Mode 1: Cash 700
    const pSelects = screen.getAllByRole('combobox');
    fireEvent.change(pSelects[2], { target: { value: '100' } }); // selects[2] is first payment mode
    const pInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(pInputs[1], { target: { value: '700' } });

    // Add UPI 700
    fireEvent.click(screen.getByRole('button', { name: /^\+ Add$/i })); // Add payment mode button specifically
    const finalSelects = screen.getAllByRole('combobox');
    fireEvent.change(finalSelects[3], { target: { value: '101' } });
    const finalInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(finalInputs[2], { target: { value: '700' } });

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
        }),
        undefined // Explicitly check for 3rd arg (new record)
      );
    });
    expect(screen.getByText(/Payment Recorded!/i)).toBeInTheDocument();
  });

  it('allows saving Free / Charity visits without payment modes', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    // Name
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'Fathima' } });
    
    // Services (Rs 400)
    await screen.findByText(/Services Rendered/i);
    const sSelects = screen.getAllByRole('combobox');
    fireEvent.change(sSelects[1], { target: { value: '10' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '400' } });

    // Check Free checkbox
    const freeCheckbox = screen.getByLabelText(/Free \/ Charity Visit/i);
    fireEvent.click(freeCheckbox);
    
    fireEvent.click(screen.getByText(/Confirm & Save/i));

    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({
          patient_name: 'Fathima',
          free_flag: true,
          payments: []
        }),
        undefined
      );
    });
    expect(screen.getByText(/Payment Recorded!/i)).toBeInTheDocument();
  });

  it('triggers PUT request when editing an existing payment', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    
    const existingPayment = {
      id: 500,
      patient_name: 'Existing Patient',
      payment_date: '2026-04-22',
      total_amount: 858,
      services: [{ service_id: 10, amount: 858 }],
      payments: [{ payment_mode_id: 100, value: 858 }]
    };

    render(<PatientPaymentForm token="fake-token" initialData={existingPayment} />);
    
    // Name should be pre-filled
    const nameInput = screen.getByPlaceholderText(/Enter full name/i);
    expect(nameInput.value).toBe('Existing Patient');

    // Change name
    fireEvent.change(nameInput, { target: { value: 'Updated Patient' } });
    
    fireEvent.click(screen.getByText(/Confirm & Save/i));

    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalledWith(
        'fake-token',
        expect.objectContaining({ patient_name: 'Updated Patient' }),
        500 // The ID should be passed as the 3rd argument
      );
    });
  });

  it('submits successfully even if an extra empty service row is present', async () => {
    api.savePatientPayment.mockResolvedValue({ success: true });
    render(<PatientPaymentForm token="fake-token" />);
    
    fireEvent.change(screen.getByPlaceholderText(/Enter full name/i), { target: { value: 'Test 2' } });
    
    await screen.findByText(/Services Rendered/i);
    const selects = screen.getAllByRole('combobox');
    
    // Fill first service
    fireEvent.change(selects[1], { target: { value: '10' } });
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '400' } });

    // Add another service row but leave it empty
    fireEvent.click(screen.getByText(/Add Service/i));
    // The second row is now present with 'Choose Service...' (id='') and amount 0
    
    // Set payment for the 400
    const paymentInputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(paymentInputs[2], { target: { value: '400' } }); // [0] is first srv, [1] is second srv (empty), [2] is first pmt
    fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: '101' } }); // [3] is first pmt mode

    fireEvent.click(screen.getByText(/Confirm & Save/i));

    await waitFor(() => {
      expect(api.savePatientPayment).toHaveBeenCalled();
    });
    expect(screen.getByText(/Payment Recorded!/i)).toBeInTheDocument();
  });
});
