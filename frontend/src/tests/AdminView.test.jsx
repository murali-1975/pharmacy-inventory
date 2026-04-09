import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import AdminView from '../views/AdminView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

// Mock dependencies if needed
vi.mock('../components/manufacturers/ManufacturerForm.jsx', () => ({
  default: ({ onCancel }) => <div data-testid="manufacturer-form"><button onClick={onCancel}>Cancel</button></div>
}));

describe('AdminView Component', () => {
  const mockProps = {
    users: [{ id: 1, username: 'admin', email: 'admin@test.com', role: 'Admin', is_active: true }],
    medicines: [],
    manufacturers: [{ id: 1, name: 'Micro Labs', is_active: true }],
    supplierTypes: [],
    statuses: [],
    onAddUser: vi.fn(),
    onEditUser: vi.fn(),
    onDeleteUser: vi.fn(),
    onSaveType: vi.fn(),
    onDeleteType: vi.fn(),
    onSaveStatus: vi.fn(),
    onDeleteStatus: vi.fn(),
    onAddManufacturer: vi.fn(),
    onEditManufacturer: vi.fn(),
    onDeleteManufacturer: vi.fn(),
    onAddMedicineMaster: vi.fn(),
    onEditMedicineMaster: vi.fn(),
    onDeleteMedicineMaster: vi.fn(),
    currentUser: { role: 'Admin' }
  };

  it('renders the admin view with navigation cards', () => {
    render(
      <TestWrapper>
        <AdminView {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Administrative Hub/i)).toBeInTheDocument();
    expect(screen.getByText(/Manufacturers/i)).toBeInTheDocument();
    expect(screen.getByText(/Users/i)).toBeInTheDocument();
  });

  it('navigates to Manufacturers tab when card is clicked', () => {
    render(
      <TestWrapper>
        <AdminView {...mockProps} />
      </TestWrapper>
    );

    const manufacturerTab = screen.getByText(/Manufacturers/i, { selector: 'span' }).closest('button');
    fireEvent.click(manufacturerTab);

    // Should now show ManufacturersView content
    expect(screen.getByRole('heading', { name: /Manufacturers/i })).toBeInTheDocument();
  });

  it('shows ManufacturerForm when Add button is clicked in Manufacturers tab', () => {
    render(
      <TestWrapper>
        <AdminView {...mockProps} />
      </TestWrapper>
    );

    // Switch to Manufacturers tab
    fireEvent.click(screen.getByText(/Manufacturers/i, { selector: 'span' }).closest('button'));

    // Click Add Manufacturer
    const addBtn = screen.getByRole('button', { name: /Add Manufacturer/i });
    fireEvent.click(addBtn);

    expect(mockProps.onAddManufacturer).toHaveBeenCalled();
  });
});
