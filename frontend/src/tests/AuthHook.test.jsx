import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

// Mock api
vi.mock('../api', () => ({
  default: {
    login: vi.fn(),
    getMe: vi.fn()
  }
}));

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with token from localStorage', () => {
    localStorage.setItem('token', 'stored-token');
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBe('stored-token');
  });

  it('login success sets token and localStorage', async () => {
    api.login.mockResolvedValue({ access_token: 'new-token' });
    const { result } = renderHook(() => useAuth());

    let success;
    await act(async () => {
      success = await result.current.login('user', 'pass');
    });

    expect(success).toBe(true);
    expect(result.current.token).toBe('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
  });

  it('logout clears token and localStorage', () => {
    localStorage.setItem('token', 'stored-token');
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBe(null);
    expect(localStorage.getItem('token')).toBe(null);
  });
});
