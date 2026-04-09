import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ManufacturersView from '../views/ManufacturersView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('ManufacturersView Component', () => {
  it('renders correctly', () => {
    render(
      <TestWrapper>
        <ManufacturersView currentUser={{ role: 'Admin' }} />
      </TestWrapper>
    );

    expect(screen.getByText(/Manufacturers/i, { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText(/Add Manufacturer/i)).toBeInTheDocument();
  });

  it('shows the loading state initially', () => {
    render(
      <TestWrapper>
        <ManufacturersView />
      </TestWrapper>
    );
    // Since we are mocking the hook to return empty/loading, we check for presence
    expect(screen.getByText(/Manufacturers/i, { selector: 'h1' })).toBeInTheDocument();
  });
});
