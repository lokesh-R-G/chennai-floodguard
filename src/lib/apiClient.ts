import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Load token from localStorage
    this.token = localStorage.getItem('auth_token');
    if (this.token) {
      this.setAuthToken(this.token);
    }

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string): void {
    this.token = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('auth_token', token);
  }

  clearAuthToken(): void {
    this.token = null;
    delete this.client.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
  }

  private async handleUnauthorized(): Promise<void> {
    // Try refresh token rotation before kicking user out
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        if (res.data?.data?.token) {
          this.setAuthToken(res.data.data.token);
          localStorage.setItem('refresh_token', res.data.data.refreshToken);
          return; // retry will be handled by interceptor caller
        }
      } catch {
        // Refresh failed — force logout
      }
    }
    this.clearAuthToken();
    window.location.href = '/auth';
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    if (response.data?.token) {
      this.setAuthToken(response.data.token);
    }
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    if (response.data?.token) {
      this.setAuthToken(response.data.token);
    }
    return response;
  }

  async savePushSubscription(userId: string, subscription: any) {
    return this.client.post('/auth/push-subscription', { userId, subscription });
  }

  // Incident endpoints
  async createIncident(data: {
    locationLat: number;
    locationLon: number;
    emergencyType: string;
    description?: string;
  }) {
    return this.client.post('/incidents', data);
  }

  async getIncidents(filters?: any) {
    return this.client.get('/incidents', { params: filters });
  }

  async getIncident(id: string) {
    return this.client.get(`/incidents/${id}`);
  }

  async getCitizenActiveIncident(citizenId: string) {
    return this.client.get(`/incidents/citizen/${citizenId}`);
  }

  async updateIncidentStatus(id: string, status: string, reason?: string) {
    return this.client.patch(`/incidents/${id}/status`, { status, reason });
  }

  // Driver endpoints
  async getDriver(id: string) {
    return this.client.get(`/drivers/${id}`);
  }

  async getDriverByUser(userId: string) {
    return this.client.get(`/drivers/by-user/${userId}`);
  }

  async updateDriverStatus(id: string, status: string) {
    return this.client.patch(`/drivers/${id}/status`, { status });
  }

  async updateDriverLocation(id: string, lat: number, lon: number) {
    return this.client.patch(`/drivers/${id}/location`, {
      currentLat: lat,
      currentLon: lon
    });
  }

  async getDriverCurrentJob(id: string) {
    return this.client.get(`/drivers/${id}/current-job`);
  }

  async getAvailableDrivers() {
    return this.client.get('/drivers/available');
  }

  // Flood zone endpoints
  async getFloodZones() {
    return this.client.get('/flood-zones');
  }

  async getFloodZone(id: string) {
    return this.client.get(`/flood-zones/${id}`);
  }

  async getZoneHistory(id: string, days: number = 7) {
    return this.client.get(`/flood-zones/${id}/history`, { params: { days } });
  }

  async getHighRiskZones() {
    return this.client.get('/flood-zones/high-risk');
  }

  // Camp endpoints
  async getCamps() {
    return this.client.get('/camps');
  }

  async getCampInventory(campId: string) {
    return this.client.get(`/camps/${campId}/inventory`);
  }

  async getAllInventory() {
    return this.client.get('/camps/inventory/all');
  }

  async updateInventory(campId: string, itemId: string, quantity: number) {
    return this.client.patch(`/camps/${campId}/inventory/${itemId}`, { quantity });
  }

  async addInventoryItem(campId: string, data: {
    itemName: string;
    quantity: number;
    unit?: string;
    minThreshold?: number;
  }) {
    return this.client.post(`/camps/${campId}/inventory`, data);
  }

  async getLowStockItems() {
    return this.client.get('/camps/low-stock');
  }

  // Health check
  async healthCheck() {
    return this.client.get('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
