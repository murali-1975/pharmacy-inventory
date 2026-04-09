import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import StatusView from '../views/StatusView.jsx';
import SupplierTypesView from '../views/SupplierTypesView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('Lookup Views', () => {
  it('renders StatusView correctly', () => {
    render(
      <TestWrapper>
        <StatusView />
      </TestWrapper>
    );
    expect(screen.getByText(/System Statuses/i)).toBeInTheDocument();
  });

  it('renders SupplierTypesView correctly', () => {
    render(
      <TestWrapper>
        <SupplierTypesView />
      </TestWrapper>
    );
    expect(screen.getByText(/Supplier Types/i)).toBeInTheDocument();
  });
});
