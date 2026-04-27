import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import DailyBreakdownModal from '../../views/Finance/DailyBreakdownModal';

const mockSummary = {
  summary_date: '2026-04-27',
  patient_count: 15,
  total_revenue: 10000,
  total_expenses: 2000,
  total_gst: 500,
  total_expense_gst: 180,
  service_breakdown: {
    'Consultation': 6000,
    'Pharmacy': 4000
  },
  payment_breakdown: {
    'Cash': 7000,
    'UPI': 3000
  },
  expense_breakdown: {
    'Salary': 1500,
    'Rent': 500
  }
};

describe('DailyBreakdownModal', () => {
  test('renders summary data correctly', () => {
    render(<DailyBreakdownModal summary={mockSummary} onClose={() => {}} />);
    
    // Check titles and date
    expect(screen.getByText(/Daily Financial Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText('27-04-2026')).toBeInTheDocument();

    // Check KPI values
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getAllByText(/10,000/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/2,000/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/8,000/)[0]).toBeInTheDocument(); // Net Income

    // Check service breakdown
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getAllByText(/6,000/)[0]).toBeInTheDocument();
    expect(screen.getByText('Pharmacy')).toBeInTheDocument();
    expect(screen.getAllByText(/4,000/)[0]).toBeInTheDocument();

    // Check expense breakdown
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getAllByText(/1,500/)[0]).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getAllByText(/500/)[0]).toBeInTheDocument();

    // Check tax summary
    expect(screen.getAllByText(/500/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/180/)[0]).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<DailyBreakdownModal summary={mockSummary} onClose={handleClose} />);
    
    const closeButtons = screen.getAllByRole('button');
    // The X icon button or the "Close" text button
    const textCloseButton = screen.getByText(/Close/i);
    fireEvent.click(textCloseButton);
    
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
