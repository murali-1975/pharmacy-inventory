import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Header from '../components/layout/Header';
import { TestWrapper } from './helpers/TestWrapper';

describe('Header Component', () => {
  const defaultProps = {
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    currentUser: { username: 'admin', role: 'Admin' }
  };

  it('renders correctly', () => {
    render(
      <TestWrapper>
        <Header {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText(/Admin Access/i)).toBeInTheDocument();
  });

  it('calls setSidebarOpen when menu button is clicked', () => {
    render(
      <TestWrapper>
        <Header {...defaultProps} />
      </TestWrapper>
    );

    const menuBtn = screen.getByRole('button', { name: /menu-toggle/i }) || screen.getAllByRole('button')[0];
    fireEvent.click(menuBtn);
    expect(defaultProps.setSidebarOpen).toHaveBeenCalled();
  });
});
