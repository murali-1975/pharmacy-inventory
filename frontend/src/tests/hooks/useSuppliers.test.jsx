import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSuppliers } from '../../hooks/useSuppliers';
import React from 'react';

describe('useSuppliers Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches suppliers correctly when fetchSuppliers is called', async () => {
    const mockSuppliers = [{ id: 1, name: 'MedHouse' }];
    global.fetch.mockResolvedValueOnce({ 
        ok: true, 
        status: 200,
        json: async () => mockSuppliers 
    });

    const { result } = renderHook(() => useSuppliers('token'));

    await act(async () => {
      await result.current.fetchSuppliers();
    });

    expect(result.current.suppliers).toEqual(mockSuppliers);
    expect(result.current.loading).toBe(false);
  });
});
