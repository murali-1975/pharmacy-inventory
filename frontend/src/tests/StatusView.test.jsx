import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import StatusView from '../views/StatusView';
import { TestWrapper } from './helpers/TestWrapper';

describe('StatusView Component', () => {
  const mockStatuses = [
    { id: 1, name: 'Active', is_active: true },
    { id: 2, name: 'Inactive', is_active: false }
  ];

  const defaultProps = {
    statuses: mockStatuses,
    onSave: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and loads statuses', () => {
    render(
      <TestWrapper>
        <StatusView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
  });

  it('calls onSave when add button is clicked', async () => {
    render(
      <TestWrapper>
        <StatusView {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/New status name/i);
    fireEvent.change(input, { target: { value: 'Pending' } });
    
    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(defaultProps.onSave).toHaveBeenCalledWith({ name: 'Pending' }, null);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(
      <TestWrapper>
        <StatusView {...defaultProps} />
      </TestWrapper>
    );

    const deleteBtns = screen.getAllByRole('button');
    // The component has "Add" button and then per-row Edit/Delete
    // Row 1: Add (0), Edit (1), Delete (2)
    fireEvent.click(deleteBtns[2]);
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });

  it('shows error when saving empty status', () => {
    render(
      <TestWrapper>
        <StatusView {...defaultProps} />
      </TestWrapper>
    );

    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Please enter a status name/i)).toBeInTheDocument();
  });
});
