const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers || {}) as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request error:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile(endpoint: string, file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('image', file);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }

      return { data };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  auth = {
    login: async (email: string, password: string) => {
      const response = await this.post<{
        user: { id: string; email: string };
        tenantId: string;
        role: string;
        token: string;
      }>('/auth/login', { email, password });

      if (response.data?.token) {
        this.setToken(response.data.token);
      }

      return response;
    },

    signup: async (email: string, password: string, name?: string) => {
      const response = await this.post<{
        user: { id: string; email: string };
        tenantId: string;
        role: string;
        token: string;
      }>('/auth/signup', { email, password, name });

      if (response.data?.token) {
        this.setToken(response.data.token);
      }

      return response;
    },

    me: async () => {
      return this.get<{ user: any }>('/auth/me');
    },

    logout: async () => {
      const response = await this.post('/auth/logout');
      this.setToken(null);
      return response;
    },
  };

  products = {
    list: () => this.get('/products'),
    get: (id: string) => this.get(`/products/${id}`),
    search: (query: string) => this.get(`/products/search/${query}`),
    create: (data: any) => this.post('/products', data),
    update: (id: string, data: any) => this.put(`/products/${id}`, data),
    delete: (id: string) => this.delete(`/products/${id}`),
  };

  inventory = {
    list: () => this.get('/inventory'),
    get: (productId: string, location?: string) =>
      this.get(`/inventory/${productId}${location ? `?location=${location}` : ''}`),
    update: (data: { product_id: string; location: string; quantity: number }) =>
      this.post('/inventory/update', data),
    adjust: (data: { product_id: string; location: string; quantity_change: number; reason: string }) =>
      this.post('/inventory/adjust', data),
  };

  categories = {
    list: () => this.get('/categories'),
    create: (data: any) => this.post('/categories', data),
    update: (id: string, data: any) => this.put(`/categories/${id}`, data),
    delete: (id: string) => this.delete(`/categories/${id}`),
  };

  customers = {
    list: () => this.get('/customers'),
    get: (id: string) => this.get(`/customers/${id}`),
    search: (query: string) => this.get(`/customers/search/${query}`),
    create: (data: any) => this.post('/customers', data),
    update: (id: string, data: any) => this.put(`/customers/${id}`, data),
  };

  transactions = {
    create: (data: any) => this.post('/transactions', data),
    list: (params?: { startDate?: string; endDate?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/transactions${query ? `?${query}` : ''}`);
    },
    get: (id: string) => this.get(`/transactions/${id}`),
  };

  sales = {
    summary: (params?: { startDate?: string; endDate?: string; groupBy?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/sales/summary${query ? `?${query}` : ''}`);
    },
    topProducts: (params?: { startDate?: string; endDate?: string; limit?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/sales/top-products${query ? `?${query}` : ''}`);
    },
  };

  recommendations = {
    get: (productId: string) => this.get(`/recommendations/${productId}`),
  };

  upload = {
    image: (file: File) => this.uploadFile('/upload/product-image', file),
  };
}

export const api = new ApiClient(API_URL);

export type { ApiResponse };
