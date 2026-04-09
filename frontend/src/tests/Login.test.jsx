import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Login from '../components/Login';
import { TestWrapper } from './helpers/TestWrapper';
import api from '../api';

// Mock the API
vi.mock('../api', () => ({
  default: {
    login: vi.fn()
  }
}));

describe('Login Component', () => {
  const defaultProps = {
    onLogin: vi.fn()
  };

  it('renders correctly', () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    // onLogin returns false if failure
    defaultProps.onLogin.mockResolvedValue(false);

    render(
      <TestWrapper>
        <Login {...defaultProps} error="Invalid username or password" />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrong' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid username or password/i)).toBeInTheDocument();
    });
  });

  it('calls onLogin on success', async () => {
    defaultProps.onLogin.mockResolvedValue(true);

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'admin' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(defaultProps.onLogin).toHaveBeenCalledWith('admin', 'admin');
    });
  });
});
