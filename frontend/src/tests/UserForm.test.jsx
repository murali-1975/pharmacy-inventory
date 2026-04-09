import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import UserForm from '../components/users/UserForm';
import { TestWrapper } from './helpers/TestWrapper';

describe('UserForm Component', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    initialData: null
  };

  it('renders correctly', () => {
    render(
      <TestWrapper>
        <UserForm {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('calls onSave with form data when submitted', async () => {
    render(
      <TestWrapper>
        <UserForm {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'Manager' } });

    const submitBtn = screen.getByRole('button', { name: /Create User/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser',
        email: 'test@user.com',
        role: 'Manager'
      }));
    });
  });

  it('populates with initialData', () => {
    const initialData = {
      id: 1,
      username: 'existinguser',
      email: 'existing@user.com',
      role: 'Pharmacist',
      is_active: true
    };
    render(
      <TestWrapper>
        <UserForm {...defaultProps} initialData={initialData} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/Username/i).value).toBe('existinguser');
    expect(screen.getByLabelText(/Email Address/i).value).toBe('existing@user.com');
  });
});
