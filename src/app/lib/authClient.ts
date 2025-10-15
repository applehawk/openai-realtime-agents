/**
 * Client for interacting with the authentication server API
 * Uses httpOnly cookies for secure token management
 */

// Normalize the base URL to ensure it ends with a slash
const normalizeBaseUrl = (url: string): string => {
  return url.endsWith('/') ? url : `${url}/`;
};

const AUTH_API_BASE = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/'
);

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
  // Remove leading slash from endpoint if present to avoid double slashes
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${AUTH_API_BASE}${normalizedEndpoint}`;

  console.log('authFetch:', {
    endpoint,
    normalizedEndpoint,
    AUTH_API_BASE,
    url,
    method: options.method || 'GET'
  });

  // For Node.js fetch, we need to handle SSL certificate rejection
  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // In development, disable SSL verification for self-signed certificates
  // Save the current value so we can restore it
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  try {
    const response = await fetch(url, fetchOptions);
    console.log('authFetch response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    return response;
  } catch (error) {
    console.error('authFetch error:', {
      url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    // Restore the original TLS setting
    if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
  }
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
      const errorText = await response.text();
      console.error('Login failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      try {
        const error = JSON.parse(errorText);
        throw new Error(error.detail || 'Login failed');
      } catch {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
    }

    const responseText = await response.text();
    console.log('Login response:', responseText);

    try {
      return JSON.parse(responseText);
    } catch (_error) {
      console.error('Failed to parse login response as JSON:', responseText);
      throw new Error('Invalid JSON response from auth server');
    }
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
      const errorText = await response.text();
      console.error('Failed to fetch user info:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }

    // Get the response text first to debug
    const responseText = await response.text();
    console.log('getCurrentUser response:', responseText);

    try {
      return JSON.parse(responseText);
    } catch (_error) {
      console.error('Failed to parse getCurrentUser response as JSON:', responseText);
      throw new Error('Invalid JSON response from auth server');
    }
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
