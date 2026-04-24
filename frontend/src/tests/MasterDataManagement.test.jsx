import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MasterDataManagement from '../views/Finance/MasterDataManagement';
import React from 'react';

// No top-level fetch mock needed as we use spyOn in beforeEach

describe('MasterDataManagement Component', () => {
  const mockMasters = {
    identifiers: [{ id: 1, id_name: 'UHID', is_active: true }],
    services: [{ id: 1, service_name: 'Scan', is_active: true }],
    payment_modes: [{ id: 1, mode: 'UPI - (Gpay)', is_active: true }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve(mockMasters)
    });
  });

  it('renders tabbed interface', async () => {
    render(<MasterDataManagement token="fake-token" onUnauthorized={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Patient Identifiers/i })).toBeInTheDocument();
  });

  it('switches tabs', async () => {
    render(<MasterDataManagement token="fake-token" onUnauthorized={vi.fn()} />);
    const tab = await screen.findByText(/Patient Services/i);
    fireEvent.click(tab);
    expect(await screen.findByText(/Manage services rendered to patients/i)).toBeInTheDocument();
  });

  it('shows mock data', async () => {
    render(<MasterDataManagement token="fake-token" onUnauthorized={vi.fn()} />);
    // Wait for the cell containing UHID to appear
    expect(await screen.findByRole('cell', { name: /UHID/i })).toBeInTheDocument();
  });

  it('has add button', async () => {
    render(<MasterDataManagement token="fake-token" onUnauthorized={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Add/i })).toBeInTheDocument();
  });
});
