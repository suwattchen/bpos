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
    formData.append('file', file);

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
      }>('/api/auth/login', { email, password });

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
      }>('/api/auth/signup', { email, password, name });

      if (response.data?.token) {
        this.setToken(response.data.token);
      }

      return response;
    },

    me: async () => {
      return this.get<{ user: any }>('/api/auth/me');
    },

    logout: async () => {
      const response = await this.post('/api/auth/logout');
      this.setToken(null);
      return response;
    },
  };

  products = {
    list: () => this.get('/api/products'),
    get: (id: string) => this.get(`/api/products/${id}`),
    search: (query: string) => this.get(`/api/products/search/${query}`),
    create: (data: any) => this.post('/api/products', data),
    update: (id: string, data: any) => this.put(`/api/products/${id}`, data),
    delete: (id: string) => this.delete(`/api/products/${id}`),
  };

  inventory = {
    list: () => this.get('/api/inventory'),
    get: (productId: string, location?: string) =>
      this.get(`/api/inventory/${productId}${location ? `?location=${location}` : ''}`),
    update: (data: { product_id: string; location: string; quantity: number }) =>
      this.post('/api/inventory/update', data),
    adjust: (data: { product_id: string; location: string; quantity_change: number; reason: string }) =>
      this.post('/api/inventory/adjust', data),
  };

  categories = {
    list: () => this.get('/api/categories'),
    create: (data: any) => this.post('/api/categories', data),
    update: (id: string, data: any) => this.put(`/api/categories/${id}`, data),
    delete: (id: string) => this.delete(`/api/categories/${id}`),
  };

  customers = {
    list: () => this.get('/api/customers'),
    get: (id: string) => this.get(`/api/customers/${id}`),
    search: (query: string) => this.get(`/api/customers/search/${query}`),
    create: (data: any) => this.post('/api/customers', data),
    update: (id: string, data: any) => this.put(`/api/customers/${id}`, data),
  };

  transactions = {
    create: (data: any) => this.post('/api/transactions', data),
    list: (params?: { startDate?: string; endDate?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/api/transactions${query ? `?${query}` : ''}`);
    },
    get: (id: string) => this.get(`/api/transactions/${id}`),
  };

  sales = {
    summary: (params?: { startDate?: string; endDate?: string; groupBy?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/api/sales/summary${query ? `?${query}` : ''}`);
    },
    topProducts: (params?: { startDate?: string; endDate?: string; limit?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return this.get(`/api/sales/top-products${query ? `?${query}` : ''}`);
    },
  };

  recommendations = {
    get: (productId: string) => this.get(`/api/recommendations/${productId}`),
  };

  upload = {
    image: (file: File) => this.uploadFile('/api/upload/image', file),
  };
}

export const api = new ApiClient(API_URL);

export type { ApiResponse };
