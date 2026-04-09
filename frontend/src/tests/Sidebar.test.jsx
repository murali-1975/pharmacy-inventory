import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import Sidebar from '../components/layout/Sidebar.jsx';

describe('Sidebar Component', () => {
  const defaultProps = {
    sidebarOpen: true,
    setSidebarOpen: vi.fn(),
    activeTab: 'dashboard',
    setActiveTab: vi.fn(),
    currentUser: { role: 'Admin' },
    logout: vi.fn(),
    logo: 'test-logo.png'
  };

  it('renders correctly when open', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Omniflow')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('renders correctly when closed', () => {
    render(<Sidebar {...defaultProps} sidebarOpen={false} />);
    expect(screen.queryByText('Omniflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
  });

  it('calls setActiveTab when items are clicked', () => {
    render(<Sidebar {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Suppliers'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('suppliers');

    fireEvent.click(screen.getByText('Invoices'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('invoices');

    fireEvent.click(screen.getByText('Dispensing'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('dispensing');

    fireEvent.click(screen.getByText('Stock Inventory'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('stock');
  });

  it('shows administration section for Admin role', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Administration')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Financial Reports'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('financials');

    fireEvent.click(screen.getByText('Admin Hub'));
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('admin');
  });

  it('hides administration section for Staff role', () => {
    render(<Sidebar {...defaultProps} currentUser={{ role: 'Staff' }} />);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('calls logout when sign out is clicked', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('Sign Out'));
    expect(defaultProps.logout).toHaveBeenCalled();
  });
});
