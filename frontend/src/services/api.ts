import type {
  ApiResponse,
  AuthTokens,
  User,
  Event,
  PizzaOption,
  Vote,
  VoteInput,
  PizzaOrderReport,
  EventHistory,
  PizzaTrend,
  ParticipationStats,
  PaginatedResponse,
} from '../types';

const API_BASE = '/api';

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  hasTokens(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      // If unauthorized and we have a refresh token, try to refresh
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refresh();
        if (refreshed) {
          // Retry the original request
          (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
          });
          return retryResponse.json();
        }
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  // Auth
  async requestSmsCode(phone: string): Promise<ApiResponse> {
    return this.request('/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async requestMagicLink(email: string): Promise<ApiResponse> {
    return this.request('/auth/request-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifySmsCode(phone: string, code: string): Promise<ApiResponse<AuthTokens>> {
    const response = await this.request<AuthTokens>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  async verifyMagicLink(token: string): Promise<ApiResponse<AuthTokens>> {
    const response = await this.request<AuthTokens>('/auth/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.accessToken) {
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', data.accessToken);
        return true;
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }

    this.clearTokens();
    return false;
  }

  logout() {
    this.clearTokens();
  }

  // Users
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('/users/me');
  }

  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request('/users');
  }

  async createUser(data: {
    name: string;
    phone: string;
    email?: string;
    role?: 'ADMIN' | 'USER';
    sendInvite?: boolean;
  }): Promise<ApiResponse<User>> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string | null;
      role?: 'ADMIN' | 'USER';
    }
  ): Promise<ApiResponse<User>> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Events
  async getEvents(): Promise<ApiResponse<Event[]>> {
    return this.request('/events');
  }

  async getActiveEvent(): Promise<ApiResponse<Event | null>> {
    return this.request('/events/active');
  }

  async getEvent(id: string): Promise<ApiResponse<Event>> {
    return this.request(`/events/${id}`);
  }

  async createEvent(data: {
    name: string;
    description?: string;
    deadline: string;
    isActive?: boolean;
    reminderMinutesBefore?: number | null;
  }): Promise<ApiResponse<Event>> {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      deadline?: string;
      isActive?: boolean;
      reminderMinutesBefore?: number | null;
    }
  ): Promise<ApiResponse<Event>> {
    return this.request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string): Promise<ApiResponse> {
    return this.request(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  // Pizza Options
  async getPizzaOptions(eventId: string): Promise<ApiResponse<PizzaOption[]>> {
    return this.request(`/events/${eventId}/pizzas`);
  }

  async createPizzaOption(
    eventId: string,
    data: {
      name: string;
      toppings: string[];
    }
  ): Promise<ApiResponse<PizzaOption>> {
    return this.request(`/events/${eventId}/pizzas`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePizzaOption(
    eventId: string,
    id: string,
    data: {
      name?: string;
      toppings?: string[];
    }
  ): Promise<ApiResponse<PizzaOption>> {
    return this.request(`/events/${eventId}/pizzas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePizzaOption(eventId: string, id: string): Promise<ApiResponse> {
    return this.request(`/events/${eventId}/pizzas/${id}`, {
      method: 'DELETE',
    });
  }

  // Votes
  async getVotes(eventId: string): Promise<ApiResponse<Vote[]>> {
    return this.request(`/events/${eventId}/votes`);
  }

  async getMyVote(eventId: string): Promise<ApiResponse<Vote | null>> {
    return this.request(`/events/${eventId}/votes/me`);
  }

  async submitVote(eventId: string, data: VoteInput): Promise<ApiResponse<Vote>> {
    return this.request(`/events/${eventId}/votes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMyVote(eventId: string): Promise<ApiResponse> {
    return this.request(`/events/${eventId}/votes/me`, {
      method: 'DELETE',
    });
  }

  // Reports
  async getReport(eventId: string): Promise<ApiResponse<PizzaOrderReport>> {
    return this.request(`/events/${eventId}/report`);
  }

  // Analytics
  async getEventHistory(
    limit = 20,
    offset = 0
  ): Promise<PaginatedResponse<EventHistory>> {
    return this.request(`/analytics/history?limit=${limit}&offset=${offset}`) as Promise<PaginatedResponse<EventHistory>>;
  }

  async getPizzaTrends(limit = 10): Promise<ApiResponse<PizzaTrend[]>> {
    return this.request(`/analytics/trends?limit=${limit}`);
  }

  async getParticipationStats(limit = 10): Promise<ApiResponse<ParticipationStats[]>> {
    return this.request(`/analytics/participation?limit=${limit}`);
  }

  // Push notifications
  async getVapidPublicKey(): Promise<ApiResponse<{ publicKey: string }>> {
    return this.request('/push/vapid-public-key');
  }

  async getPushStatus(): Promise<ApiResponse<{ enabled: boolean; subscribed: boolean }>> {
    return this.request('/push/status');
  }

  async subscribeToPush(subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  }): Promise<ApiResponse> {
    return this.request('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  }

  async unsubscribeFromPush(): Promise<ApiResponse> {
    return this.request('/push/subscribe', {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
