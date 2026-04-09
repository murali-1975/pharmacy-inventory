import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLookups } from '../../hooks/useLookups';
import React from 'react';

describe('useLookups Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches statuses and supplier types when fetchLookups is called', async () => {
    const mockStatuses = [{ id: 1, name: 'Active' }];
    const mockTypes = [{ id: 1, name: 'Wholesale' }];

    global.fetch.mockImplementation((url) => {
      if (url.includes('/lookups/status/')) return Promise.resolve({ ok: true, json: async () => mockStatuses });
      if (url.includes('/lookups/supplier-types/')) return Promise.resolve({ ok: true, json: async () => mockTypes });
      return Promise.reject(new Error('Unknown URL'));
    });

    const onUnauthorized = vi.fn();
    const { result } = renderHook(() => useLookups('token', onUnauthorized));

    await act(async () => {
      await result.current.fetchLookups();
    });

    expect(result.current.statuses).toEqual(mockStatuses);
    expect(result.current.types).toEqual(mockTypes);
  });

  it('handles unauthorized error', async () => {
    global.fetch.mockImplementationOnce(() => Promise.resolve({ 
        ok: false, 
        status: 401,
        json: async () => ({ detail: 'Unauthorized' })
    }));
    
    // api.getSupplierTypes will throw because handleResponse throws on 401
    // Actually the api wrapper is imported in the hook, so I must mock the api calls or let them use the mocked fetch
    
    const onUnauthorized = vi.fn();
    const { result } = renderHook(() => useLookups('token', onUnauthorized));

    await act(async () => {
      await result.current.fetchLookups();
    });

    expect(onUnauthorized).toHaveBeenCalled();
  });
});
