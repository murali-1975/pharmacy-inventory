import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FinanceDashboard from '../views/Finance/FinanceDashboard';
import api from '../api';

// Mock the api utility
vi.mock('../api', () => ({
  default: {
    getFinanceDashboardStats: vi.fn()
  }
}));

const mockStats = {
  total_income_today: 1000,
  total_income_yesterday: 500,
  total_income_month: 5000,
  total_income_prev_month_mtd: 4000,
  patient_count_today: 10,
  patient_count_yesterday: 5,
  avg_ticket_size: 100,
  avg_ticket_yesterday: 100,
  service_distribution: [
    { service_name: 'Medicine', total_amount: 3000, count: 5 },
    { service_name: 'Consultation', total_amount: 2000, count: 5 }
  ],
  payment_mode_distribution: [
    { mode_name: 'Cash', total_value: 5000, count: 10 }
  ],
  recent_trends: [
    { date: '2026-04-25', amount: 1000 }
  ]
};

describe('FinanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getFinanceDashboardStats.mockResolvedValue(mockStats);
  });

  it('renders initial dashboard stats', async () => {
    render(<FinanceDashboard token="fake-token" />);
    
    expect(await screen.findByText(/Income by Service/i)).toBeInTheDocument();
    // Use findAllByText because multiple metrics might share the same value (e.g. 5,000)
    const figures = await screen.findAllByText('₹5,000');
    expect(figures.length).toBeGreaterThan(0);
    expect(screen.getByText('Medicine')).toBeInTheDocument();
  });

  it('sets today range when "Today" button is clicked', async () => {
    const today = new Date().toISOString().split('T')[0];
    render(<FinanceDashboard token="fake-token" />);
    
    const todayBtn = await screen.findByRole('button', { name: /Today/i });
    fireEvent.click(todayBtn);

    await waitFor(() => {
      const calls = api.getFinanceDashboardStats.mock.calls;
      const hasTodayCall = calls.some(call => 
        call[1] === today && call[2] === today
      );
      expect(hasTodayCall).toBe(true);
    });
  });
});
