import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExpenseHistory from '../views/Finance/ExpenseHistory';
import React from 'react';

// Mock API
vi.mock('../api', () => ({
  default: {
    getFinanceMasters: vi.fn().mockResolvedValue({ expense_types: [], payment_modes: [] }),
    getExpenses: vi.fn().mockResolvedValue({ items: [], total: 0 })
  }
}));

describe('ExpenseHistory', () => {
  const mockToken = 'test-token';
  const mockOnUnauthorized = vi.fn();
  const mockOnEdit = vi.fn();
  const mockCurrentUser = { role: 'Admin', username: 'admin' };

  it('renders correctly without crashing', async () => {
    render(
      <ExpenseHistory 
        token={mockToken} 
        onEdit={mockOnEdit} 
        onUnauthorized={mockOnUnauthorized} 
        currentUser={mockCurrentUser} 
      />
    );
    
    // Check for header
    expect(screen.getByText(/Expense History/i)).toBeDefined();
    
    // Check for filter row labels
    expect(screen.getByText(/Expense Category Filter/i)).toBeDefined();
    expect(screen.getByText(/Audit Start Date/i)).toBeDefined();
    expect(screen.getByText(/Audit End Date/i)).toBeDefined();
  });

  it('shows empty state when no expenses are found', async () => {
    render(
      <ExpenseHistory 
        token={mockToken} 
        onEdit={mockOnEdit} 
        onUnauthorized={mockOnUnauthorized} 
        currentUser={mockCurrentUser} 
      />
    );
    
    // Wait for the empty state message
    const emptyMsg = await screen.findByText(/No matching audit records found/i);
    expect(emptyMsg).toBeDefined();
  });

  it('formats dates as DD-MM-YYYY', async () => {
    const mockExpense = {
      id: 1,
      expense_date: '2026-04-26', // ISO date from backend
      expense_type: { name: 'Rent' },
      details: 'April Rent',
      total_amount: 5000,
      payments: []
    };
    
    const api = (await import('../api')).default;
    api.getExpenses.mockResolvedValueOnce({ items: [mockExpense], total: 1 });

    render(
      <ExpenseHistory 
        token={mockToken} 
        onEdit={mockOnEdit} 
        onUnauthorized={mockOnUnauthorized} 
        currentUser={mockCurrentUser} 
      />
    );

    // Wait for the formatted date to appear
    const formattedDate = await screen.findByText('26-04-2026');
    expect(formattedDate).toBeDefined();
  });
});
