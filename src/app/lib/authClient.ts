/**
 * Client for interacting with the authentication server API
 * Uses httpOnly cookies for secure token management
 */

const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/api/v1';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface GoogleAuthUrlResponse {
  auth_url: string;
  state: string;
}

export interface GoogleStatusResponse {
  gmail_connected: boolean;
  calendar_connected: boolean;
}

/**
 * Make authenticated request to auth server
 */
async function authFetch(endpoint: string, options: RequestInit = {}) {
  // Ensure proper URL formatting with single slash between base and endpoint
  const baseUrl = AUTH_API_BASE.endsWith('/') ? AUTH_API_BASE.slice(0, -1) : AUTH_API_BASE;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${baseUrl}/${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

export const authClient = {
  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const response = await authFetch('auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ message: string }> {
    const response = await authFetch('auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  },

  /**
   * Get current user info
   */
  async getCurrentUser(accessToken: string) {
    const response = await authFetch('auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await authFetch('auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return response.json();
  },

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    await authFetch('auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Get Google OAuth URL
   */
  async getGoogleAuthUrl(accessToken: string): Promise<GoogleAuthUrlResponse> {
    const response = await authFetch('google/auth/url', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get OAuth URL');
    }

    return response.json();
  },

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code: string, state: string, accessToken: string) {
    const response = await authFetch(`google/auth/callback?code=${code}&state=${state}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('OAuth callback failed');
    }

    return response.json();
  },

  /**
   * Get Google integration status
   */
  async getGoogleStatus(accessToken: string): Promise<GoogleStatusResponse> {
    const response = await authFetch('google/status', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Google status');
    }

    return response.json();
  },

  /**
   * Disconnect all Google services
   */
  async disconnectGoogle(accessToken: string): Promise<void> {
    const response = await authFetch('google/disconnect/all', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect Google');
    }
  },
};
