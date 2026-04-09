import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import DispensingView from '../views/DispensingView';

// Helper to mock fetch responses
const mockFetch = (data, ok = true) => {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => data,
  });
};

describe('DispensingView', () => {
  const mockMedicines = [
    { 
      id: 1, 
      product_name: 'Paracetamol', 
      generic_name: 'Acetaminophen', 
      selling_price_percent: 10,
      quantity_on_hand: 50
    },
    { 
      id: 2, 
      product_name: 'Amoxicillin', 
      generic_name: 'Penicillin', 
      selling_price_percent: 5,
      quantity_on_hand: 0
    }
  ];

  const mockToken = 'test-token';
  const mockUserRole = 'Admin';

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    // Default mock for history fetch
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 })
    });
    // Mock scrollIntoView for JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders correctly with initial empty row', () => {
    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    expect(screen.getByRole('heading', { level: 2, name: /Medicine Dispensing/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Patient Name/i)).toBeInTheDocument();
    // Should have one initial row (searching for the plus icon or add medicine button)
    expect(screen.getByText(/\+ Add Medicine/i)).toBeInTheDocument();
  });

  it('adds a new row when "+ Add Medicine" is clicked', async () => {
    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    // Initially count inputs or rows. Let's use placeholders as a proxy.
    const initialInputs = screen.getAllByPlaceholderText(/Search medicine\.\.\./i);
    expect(initialInputs).toHaveLength(1);

    fireEvent.click(screen.getByText(/\+ Add Medicine/i));
    
    expect(screen.getAllByPlaceholderText(/Search medicine\.\.\./i)).toHaveLength(2);
  });

  it('filters out zero-stock medicines and shows stock count in results', async () => {
    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    const searchInput = screen.getByPlaceholderText(/Search medicine\.\.\./i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'a' } }); // Search for 'a' to match both nominally
    
    // Paracetamol (50) should be there
    expect(await screen.findByText('Paracetamol (50)')).toBeInTheDocument();
    
    // Amoxicillin (0 stock) should NOT be there
    expect(screen.queryByText(/Amoxicillin/i)).not.toBeInTheDocument();
  });

  it('validates patient name before saving', async () => {
    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    fireEvent.click(screen.getByText(/Save All/i));
    
    expect(await screen.findByText(/Please enter a Patient Name/i)).toBeInTheDocument();
  });

  it('auto-fills price and gst when medicine is selected', async () => {
    // Mock batch info fetch
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/batches?active_only=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            batch_no: 'B123',
            expiry_date: '2025-12-31',
            mrp: 100,
            purchase_price: 80,
            gst: 12
          }]
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [], total: 0 }) });
    });

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    const searchInput = screen.getByPlaceholderText(/Search medicine\.\.\./i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Paracetamol' } });
    
    const option = await screen.findByText('Paracetamol (50)');
    fireEvent.mouseDown(option);

    // Wait for auto-fill logic (it calls fetch)
    await waitFor(() => {
      // Selling price 10% discount from MRP 100 = 90
      expect(screen.getByDisplayValue('90')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    });
  });

  it('handles successful bulk save', async () => {
    // Mock for batch check and then post
    globalThis.fetch.mockImplementation((url) => {
      if (url.endsWith('/dispensing/')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 101 }) });
      }
      if (url.includes('/batches?active_only=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            batch_no: 'B123',
            expiry_date: '2025-12-31',
            mrp: 100,
            purchase_price: 80,
            gst: 12
          }]
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ items: [], total: 0 }) });
    });

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    // Fill patient name
    fireEvent.change(screen.getByLabelText(/Patient Name/i), { target: { value: 'John Doe' } });
    
    // Select medicine
    const searchInput = screen.getByPlaceholderText(/Search medicine\.\.\./i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Paracetamol' } });
    const option = await screen.findByText('Paracetamol (50)');
    fireEvent.mouseDown(option);

    // Wait for auto-fill price
    await waitFor(() => expect(screen.getByDisplayValue('90')).toBeInTheDocument());

    // Fill quantity
    const qtyInput = screen.getAllByPlaceholderText('0')[0];
    fireEvent.change(qtyInput, { target: { value: '2' } });

    // Save
    fireEvent.click(screen.getByText(/Save All/i));

    expect(await screen.findByText(/All 1 dispensing entries saved/i)).toBeInTheDocument();
  });

  it('switches to history tab and loads records', async () => {
    const mockHistory = {
      items: [
        { 
          id: 1, 
          dispensed_date: '2024-04-01', 
          patient_name: 'Alice', 
          medicine: { product_name: 'Paracetamol' }, 
          quantity: 1, 
          unit_price: 50,
          total_amount: 50,
          status: 'Active'
        }
      ],
      total: 1
    };

    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/dispensing/')) {
        return Promise.resolve({ ok: true, json: async () => mockHistory });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    fireEvent.click(screen.getByText(/Dispensing History/i));
    
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    const table = document.getElementById('dispensing-history-table');
    expect(within(table).getByText('01-04-2024')).toBeInTheDocument();
    expect(within(table).getByText('Paracetamol')).toBeInTheDocument();
  });

  it('removes a row when the "✕" button is clicked', async () => {
    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    // Add a second row
    fireEvent.click(screen.getByText(/\+ Add Medicine/i));
    expect(screen.getAllByPlaceholderText(/Search medicine\.\.\./i)).toHaveLength(2);
    
    // Remove the first row
    const removeButtons = screen.getAllByText('✕');
    fireEvent.click(removeButtons[0]);
    
    expect(screen.getAllByPlaceholderText(/Search medicine\.\.\./i)).toHaveLength(1);
  });

  it('shows error when API fails during save', async () => {
    globalThis.fetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        json: async () => ({ detail: 'Low stock error' })
      })
    );

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    fireEvent.change(screen.getByLabelText(/Patient Name/i), { target: { value: 'John Doe' } });
    
    // Select medicine
    const searchInput = screen.getByPlaceholderText(/Search medicine\.\.\./i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Paracetamol' } });
    const option = await screen.findByText('Paracetamol (50)');
    fireEvent.mouseDown(option);

    // Fill quantity
    const qtyInput = screen.getAllByPlaceholderText('0')[0];
    fireEvent.change(qtyInput, { target: { value: '5' } });

    // Fill price
    const priceInput = screen.getAllByPlaceholderText('0.00')[0];
    fireEvent.change(priceInput, { target: { value: '10' } });

    fireEvent.click(screen.getByText(/Save All/i));

    expect(await screen.findByText(/Low stock error/i)).toBeInTheDocument();
  });

  it('handles pagination in history tab', async () => {
    const mockLargeHistory = {
      items: new Array(20).fill({}).map((_, i) => ({
        id: i + 1,
        dispensed_date: '2024-04-01',
        patient_name: `Patient ${i + 1}`,
        medicine: { product_name: 'Paracetamol' },
        quantity: 1,
        unit_price: 10,
        total_amount: 10,
        status: 'Active'
      })),
      total: 50
    };

    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockLargeHistory
    });

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    fireEvent.click(screen.getByText(/Dispensing History/i));
    
    await waitFor(() => {
      const summary = screen.getByText((content, element) => {
        return element.tagName.toLowerCase() === 'div' && 
               content.includes('Showing') && 
               content.includes('records');
      });
      expect(summary.textContent).toMatch(/Showing 1 to 20 of 50 records/i);
    });

    // Click Next
    const nextButton = screen.getByTitle('Next Page');
    fireEvent.click(nextButton);

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('skip=20'), expect.anything());
  });

  it('handles bulk upload CSV preview and mapping', async () => {
    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(function() {
        setTimeout(() => {
           if (this.onload) this.onload({ target: { result: 'date,patient,medicine_name,quantity\n2024-04-01,John,UnknownMed,5' } });
        }, 0);
      }),
      onload: null
    };
    vi.stubGlobal('FileReader', class {
      constructor() {
        return mockFileReader;
      }
    });

    render(<DispensingView medicines={mockMedicines} token={mockToken} userRole={mockUserRole} />);
    
    fireEvent.click(screen.getByText(/Bulk Upload/i));
    
    expect(screen.getByText(/Bulk Dispensing Upload/i)).toBeInTheDocument();

    const file = new File(['date,patient,medicine_name,quantity\n2024-04-01,John,UnknownMed,5'], 'test.csv', { type: 'text/csv' });
    
    // Trigger handleFileSelect manually since we can't easily trigger hidden input in this setup
    // But we can find the input if we look for the hidden one
    const hiddenInput = document.getElementById("bulk-upload-input");
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    // Preview should show
    expect(await screen.findByText(/📊 Preview/i)).toBeInTheDocument();
    expect(screen.getByText('01-04-2024')).toBeInTheDocument();
    expect(screen.getByText(/UnknownMed/i)).toBeInTheDocument();
    expect(screen.getByText(/Fix Mapping/i)).toBeInTheDocument();

    // Fix mapping
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Paracetamol/i)).toBeInTheDocument();
  });
});
