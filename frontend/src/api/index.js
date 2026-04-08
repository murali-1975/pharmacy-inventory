const API_BASE = '/api';

const getHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

/**
 * Centered response handler for standardizing error reporting and 401 detection.
 */
const handleResponse = async (res) => {
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    throw { status: 409, message: data.detail || 'Conflict error', detail: data.detail };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Specific business error details
    if (data.detail && typeof data.detail === 'object') {
       throw new Error(data.detail.msg || JSON.stringify(data.detail));
    }
    throw new Error(data.detail || `Request failed with status ${res.status}`);
  }
  
  if (res.status === 204) return null;
  return res.json();
};

export const api = {
  // Auth
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const res = await fetch(`${API_BASE}/token/`, {
      method: 'POST',
      body: formData
    });
    return handleResponse(res);
  },

  register: async (username, email, password) => {
    const res = await fetch(`${API_BASE}/register/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, email, password })
    });
    return handleResponse(res);
  },

  getMe: async (token) => {
    const res = await fetch(`${API_BASE}/users/me/`, {
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Lookups
  getStatuses: async (token, includeInactive = false) => {
    const url = includeInactive ? `${API_BASE}/lookups/status/?include_inactive=true` : `${API_BASE}/lookups/status/`;
    const res = await fetch(url, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveStatus: async (token, statusData, id = null) => {
    const url = id ? `${API_BASE}/lookups/status/${id}/` : `${API_BASE}/lookups/status/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(statusData)
    });
    return handleResponse(res);
  },

  deleteStatus: async (token, id, hard = false) => {
    const url = hard ? `${API_BASE}/lookups/status/${id}/?hard=true` : `${API_BASE}/lookups/status/${id}/`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  getSupplierTypes: async (token, includeInactive = false) => {
    const url = includeInactive ? `${API_BASE}/lookups/supplier-types/?include_inactive=true` : `${API_BASE}/lookups/supplier-types/`;
    const res = await fetch(url, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveSupplierType: async (token, typeData, id = null) => {
    const url = id ? `${API_BASE}/lookups/supplier-types/${id}/` : `${API_BASE}/lookups/supplier-types/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(typeData)
    });
    return handleResponse(res);
  },

  deleteSupplierType: async (token, id, hard = false) => {
    const url = hard ? `${API_BASE}/lookups/supplier-types/${id}/?hard=true` : `${API_BASE}/lookups/supplier-types/${id}/`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Suppliers
  getSuppliers: async (token) => {
    const res = await fetch(`${API_BASE}/suppliers/`, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveSupplier: async (token, supplierData, id = null) => {
    const url = id ? `${API_BASE}/suppliers/${id}/` : `${API_BASE}/suppliers/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(supplierData)
    });
    return handleResponse(res);
  },

  deleteSupplier: async (token, id) => {
    const res = await fetch(`${API_BASE}/suppliers/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Users
  getUsers: async (token) => {
    const res = await fetch(`${API_BASE}/users/`, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveUser: async (token, userData, id = null) => {
    const url = id ? `${API_BASE}/users/${id}/` : `${API_BASE}/users/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(userData)
    });
    return handleResponse(res);
  },

  deleteUser: async (token, id) => {
    const res = await fetch(`${API_BASE}/users/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Invoices
  getInvoices: async (token, skip = 0, limit = 10, search = '', sortBy = 'invoice_date', sortOrder = 'desc') => {
    let url = `${API_BASE}/invoices/?skip=${skip}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
    if (search) url += `&q=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveInvoice: async (token, invoiceData, id = null) => {
    const url = id ? `${API_BASE}/invoices/${id}/` : `${API_BASE}/invoices/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(invoiceData)
    });
    return handleResponse(res);
  },

  deleteInvoice: async (token, id) => {
    const res = await fetch(`${API_BASE}/invoices/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  addInvoicePayment: async (id, paymentData, token) => {
    const res = await fetch(`${API_BASE}/invoices/${id}/payments/`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(paymentData)
    });
    return handleResponse(res);
  },

  getInvoicePayments: async (id, token) => {
    const res = await fetch(`${API_BASE}/invoices/${id}/payments/`, {
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  uploadInvoices: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/invoices/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type, browser will set it with boundary
      },
      body: formData
    });
    return handleResponse(res);
  },

  getInvoiceTemplate: async (token) => {
    const res = await fetch(`${API_BASE}/invoices/template`, {
      headers: getHeaders(token)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to download template');
    return res.blob();
  },

  // Medicines
  getMedicines: async (token) => {
    const res = await fetch(`${API_BASE}/medicines/`, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveMedicine: async (token, medicineData, id = null) => {
    const url = id ? `${API_BASE}/medicines/${id}/` : `${API_BASE}/medicines/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(medicineData)
    });
    return handleResponse(res);
  },

  deleteMedicine: async (token, id) => {
    const res = await fetch(`${API_BASE}/medicines/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Manufacturers
  getManufacturers: async (token) => {
    const res = await fetch(`${API_BASE}/manufacturers/`, { headers: getHeaders(token) });
    return handleResponse(res);
  },

  saveManufacturer: async (token, manufacturerData, id = null) => {
    const url = id ? `${API_BASE}/manufacturers/${id}/` : `${API_BASE}/manufacturers/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(manufacturerData)
    });
    return handleResponse(res);
  },

  deleteManufacturer: async (token, id) => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  // Dispensing
  getDispensingPrice: async (medicineId, token) => {
    const res = await fetch(`${API_BASE}/dispensing/price/${medicineId}`, {
      headers: getHeaders(token)
    });
    return handleResponse(res);
  },

  uploadDispensing: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/dispensing/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    return handleResponse(res);
  },

  getDispensingTemplate: async (token) => {
    const res = await fetch(`${API_BASE}/dispensing/template`, {
      headers: getHeaders(token)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to download template');
    return res.blob();
  }
};

export default api;

