const API_BASE = 'http://localhost:8000';

const getHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

export const api = {
  // Auth
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const res = await fetch(`${API_BASE}/token`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Invalid username or password');
    return res.json();
  },

  register: async (username, email, password) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Registration failed');
    }
    return res.json();
  },

  getMe: async (token) => {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  // Lookups
  getStatuses: async (token) => {
    const res = await fetch(`${API_BASE}/status/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch statuses');
    return res.json();
  },

  saveStatus: async (token, statusData, id = null) => {
    const url = id ? `${API_BASE}/status/${id}/` : `${API_BASE}/status/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(statusData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save status');
    return res.json();
  },

  deleteStatus: async (token, id, soft = false) => {
    const url = soft ? `${API_BASE}/status/${id}?soft=true` : `${API_BASE}/status/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (res.status === 409) {
      const data = await res.json();
      throw { status: 409, ...data.detail };
    }
    if (!res.ok) throw new Error('Failed to delete status');
    return res.json();
  },

  getSupplierTypes: async (token) => {
    const res = await fetch(`${API_BASE}/supplier-types/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch supplier types');
    return res.json();
  },

  saveSupplierType: async (token, typeData, id = null) => {
    const url = id ? `${API_BASE}/supplier-types/${id}/` : `${API_BASE}/supplier-types/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(typeData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save supplier type');
    return res.json();
  },

  deleteSupplierType: async (token, id, soft = false) => {
    const url = soft ? `${API_BASE}/supplier-types/${id}?soft=true` : `${API_BASE}/supplier-types/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (res.status === 409) {
      const data = await res.json();
      throw { status: 409, ...data.detail };
    }
    if (!res.ok) throw new Error('Failed to delete supplier type');
    return res.json();
  },

  // Suppliers
  getSuppliers: async (token) => {
    const res = await fetch(`${API_BASE}/suppliers/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  saveSupplier: async (token, supplierData, id = null) => {
    const url = id ? `${API_BASE}/suppliers/${id}/` : `${API_BASE}/suppliers/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(supplierData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save supplier');
    return res.json();
  },

  deleteSupplier: async (token, id) => {
    const res = await fetch(`${API_BASE}/suppliers/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete supplier');
    return res.json();
  },

  // Users
  getUsers: async (token) => {
    const res = await fetch(`${API_BASE}/users/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  saveUser: async (token, userData, id = null) => {
    const url = id ? `${API_BASE}/users/${id}/` : `${API_BASE}/users/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(userData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Failed to save user');
    }
    return res.json();
  },

  deleteUser: async (token, id) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  // Invoices
  getInvoices: async (token, skip = 0, limit = 10) => {
    const res = await fetch(`${API_BASE}/invoices/?skip=${skip}&limit=${limit}`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  saveInvoice: async (token, invoiceData, id = null) => {
    const url = id ? `${API_BASE}/invoices/${id}/` : `${API_BASE}/invoices/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(invoiceData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save invoice');
    return res.json();
  },

  deleteInvoice: async (token, id) => {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete invoice');
    if (res.status === 204) return null;
    return res.json();
  },

  addInvoicePayment: async (id, paymentData, token) => {
    const res = await fetch(`${API_BASE}/invoices/${id}/payments`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(paymentData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (res.status === 422) {
      const data = await res.json();
      throw new Error(Array.isArray(data.detail) ? data.detail[0].msg : data.detail);
    }
    if (!res.ok) throw new Error('Failed to record payment');
    return res.json();
  },

  getInvoicePayments: async (id, token) => {
    const res = await fetch(`${API_BASE}/invoices/${id}/payments`, {
      headers: getHeaders(token)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch invoice payments');
    return res.json();
  },

  // Medicines
  getMedicines: async (token) => {
    const res = await fetch(`${API_BASE}/medicines/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch medicines');
    return res.json();
  },

  saveMedicine: async (token, medicineData, id = null) => {
    const url = id ? `${API_BASE}/medicines/${id}/` : `${API_BASE}/medicines/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(medicineData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save medicine');
    return res.json();
  },

  deleteMedicine: async (token, id) => {
    const res = await fetch(`${API_BASE}/medicines/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete medicine');
    return res.json();
  },

  // Manufacturers
  getManufacturers: async (token) => {
    const res = await fetch(`${API_BASE}/manufacturers/`, { headers: getHeaders(token) });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to fetch manufacturers');
    return res.json();
  },

  saveManufacturer: async (token, manufacturerData, id = null) => {
    const url = id ? `${API_BASE}/manufacturers/${id}/` : `${API_BASE}/manufacturers/`;
    const res = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(manufacturerData)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) throw new Error('Failed to save manufacturer');
    return res.json();
  },

  deleteManufacturer: async (token, id) => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete manufacturer');
    return res.json();
  }
};

export default api;
