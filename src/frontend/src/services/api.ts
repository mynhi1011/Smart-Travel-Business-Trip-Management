const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

let accessToken: string | null = null;

export interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? 'Không thể kết nối đến máy chủ.');
    this.status = status;
    this.code = body.error;
    this.details = body.details;
  }
}

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'TRAVEL_ADMIN' | 'FINANCE' | 'ADMIN';
  jobGrade: string;
  department: string | null;
  managerId: string | null;
}

interface LoginResponse {
  accessToken: string;
  user: BackendUser;
}

interface RequestOptions extends RequestInit {
  skipRefresh?: boolean;
}

function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipRefresh = false, headers, body, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers: requestHeaders,
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    if (response.status === 401 && payload.error === 'TOKEN_EXPIRED' && !skipRefresh) {
      await refreshAccessToken();
      return request<T>(path, { ...options, skipRefresh: true });
    }
    throw new ApiError(response.status, payload);
  }
  return payload as T;
}

async function refreshAccessToken(): Promise<void> {
  const result = await request<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    skipRefresh: true,
  });
  setAccessToken(result.accessToken);
}

export const authApi = {
  async login(email: string, password: string): Promise<BackendUser> {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipRefresh: true,
    });
    setAccessToken(result.accessToken);
    return result.user;
  },

  async restoreSession(): Promise<BackendUser> {
    await refreshAccessToken();
    return request<BackendUser>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/auth/logout', { method: 'DELETE', skipRefresh: true });
    } finally {
      setAccessToken(null);
    }
  },
};

export { request as apiRequest };
