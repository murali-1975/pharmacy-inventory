import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import UsersView from '../views/UsersView.jsx';
import { TestWrapper } from './helpers/TestWrapper.jsx';

describe('UsersView Component', () => {
  it('renders correctly', () => {
    render(
      <TestWrapper>
        <UsersView />
      </TestWrapper>
    );

    expect(screen.getByText(/User Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Add New User/i)).toBeInTheDocument();
  });
});
