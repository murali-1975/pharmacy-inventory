import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../api/index';

describe('API Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('handleResponse', () => {
    it('throws Unauthorized on 401', async () => {
      global.fetch.mockResolvedValueOnce({ status: 401 });
      await expect(api.getMe('token')).rejects.toThrow('Unauthorized');
    });

    it('throws Conflict on 409', async () => {
      global.fetch.mockResolvedValueOnce({ 
        status: 409, 
        ok: false,
        json: async () => ({ detail: 'Already exists' })
      });
      try {
        await api.saveStatus('token', { name: 'Test' });
      } catch (e) {
        expect(e.status).toBe(409);
        expect(e.message).toBe('Already exists');
      }
    });

    it('returns null on 204', async () => {
      global.fetch.mockResolvedValueOnce({ status: 204, ok: true });
      const result = await api.deleteStatus('token', 1);
      expect(result).toBeNull();
    });

    it('returns json on success', async () => {
      const mockData = { id: 1, name: 'Active' };
      global.fetch.mockResolvedValueOnce({ 
        status: 200, 
        ok: true, 
        json: async () => mockData 
      });
      const result = await api.getStatuses('token');
      expect(result).toEqual(mockData);
    });
  });

  describe('API Methods', () => {
    it('login calls correct endpoint with form data', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: '123' }) });
      await api.login('user', 'pass');
      expect(global.fetch).toHaveBeenCalledWith('/api/token/', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      }));
    });

    it('getInvoices constructs URL with params', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      await api.getInvoices('token', 10, 20, 'search', 'date', 'asc');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/invoices/?skip=10&limit=20&sort_by=date&sort_order=asc&q=search'),
        expect.any(Object)
      );
    });

    it('uploadInvoices use multipart without manual boundary', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      const file = new File([''], 'test.csv');
      await api.uploadInvoices('token', file);
      expect(global.fetch).toHaveBeenCalledWith('/api/invoices/upload', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      }));
    });

    it('getInvoiceTemplate returns blob', async () => {
      const mockBlob = new Blob([''], { type: 'text/csv' });
      global.fetch.mockResolvedValueOnce({ 
        ok: true, 
        status: 200, 
        blob: async () => mockBlob 
      });
      const result = await api.getInvoiceTemplate('token');
      expect(result).toBe(mockBlob);
    });
  });
});
