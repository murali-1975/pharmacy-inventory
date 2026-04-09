import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import UsersView from '../views/UsersView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('UsersView Component', () => {
  const mockUsers = [
    { id: 1, username: 'admin', email: 'admin@test.com', role: 'Admin', is_active: true },
    { id: 2, username: 'staff1', email: 'staff1@test.com', role: 'Staff', is_active: false }
  ];

  const mockProps = {
    users: mockUsers,
    onAddClick: vi.fn(),
    onEditClick: vi.fn(),
    onDeleteClick: vi.fn()
  };

  it('renders correctly with users', () => {
    render(
      <TestWrapper>
        <UsersView {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('staff1')).toBeInTheDocument();
    expect(screen.getByText('staff1@test.com')).toBeInTheDocument();
  });

  it('filters users by search term', () => {
    render(
      <TestWrapper>
        <UsersView {...mockProps} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search users/i);
    fireEvent.change(searchInput, { target: { value: 'admin' } });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.queryByText('staff1')).not.toBeInTheDocument();
  });

  it('calls onAddClick when Add button is clicked', () => {
    render(
      <TestWrapper>
        <UsersView {...mockProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Add New User/i));
    expect(mockProps.onAddClick).toHaveBeenCalled();
  });

  it('calls onEditClick and onDeleteClick when buttons are clicked', () => {
    render(
      <TestWrapper>
        <UsersView {...mockProps} />
      </TestWrapper>
    );

    // Buttons are in a group that might be hidden by opacity-0 but RTL can still see them
    // or we can find them by text
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockProps.onEditClick).toHaveBeenCalledWith(mockUsers[0]);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(mockProps.onDeleteClick).toHaveBeenCalledWith(mockUsers[0].id);
  });
});
