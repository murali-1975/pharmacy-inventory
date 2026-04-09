import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Sidebar from '../components/layout/Sidebar';
import { TestWrapper } from './helpers/TestWrapper';

describe('Sidebar Component', () => {
  const defaultProps = {
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    activeTab: 'dashboard',
    setActiveTab: vi.fn(),
    currentUser: { username: 'admin', role: 'Admin' },
    logout: vi.fn(),
    logo: 'test-logo.png'
  };

  it('renders correctly when open', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/Omniflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Financial Reports/i)).toBeInTheDocument(); // Admin only
    expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
  });

  it('calls setActiveTab when an item is clicked', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Suppliers/i));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('suppliers');
  });

  it('calls logout when sign out is clicked', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText(/Sign Out/i));
    expect(defaultProps.logout).toHaveBeenCalled();
  });

  it('does not show admin items for non-admin user', () => {
    const props = { ...defaultProps, currentUser: { role: 'Staff' } };
    render(
      <TestWrapper>
        <Sidebar {...props} />
      </TestWrapper>
    );

    expect(screen.queryByText(/Financial Reports/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin Hub/i)).not.toBeInTheDocument();
  });
});
