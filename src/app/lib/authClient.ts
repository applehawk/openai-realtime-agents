/**
 * Client for interacting with the authentication server API
 * Uses httpOnly cookies for secure token management
 */

// Normalize the base URL to ensure it ends with a slash
const normalizeBaseUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  return url.endsWith('/') ? url : `${url}/`;
};


/**
 * Выбор базового URL в зависимости от окружения исполнения.
 * - На сервере (Node) используем AUTH_API_BASE (не public) — внутренний Docker hostname.
 * - В браузере используем NEXT_PUBLIC_AUTH_API_URL (public или относительный).
 * Вызывается лениво во время выполнения, а не во время сборки.
 */
const getAuthApiBase = (): string => {
  // серверная среда (Node) — используем AUTH_API_BASE
  if (typeof window === 'undefined') {
    const internal = normalizeBaseUrl(process.env.AUTH_API_BASE);
    if (!internal) {
      throw new Error('AUTH_API_BASE is not set for server-side requests. Please add AUTH_API_BASE to your .env file.');
    }
    return internal;
  }

  // браузерная среда — используем публичную переменную
  const publicUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_AUTH_API_URL) || '/';
  return publicUrl;
};

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


/**
 * Make authenticated request to auth server
 */
async function authFetch(endpoint: string, options: RequestInit = {}) {
  // Remove leading slash from endpoint if present to avoid double slashes
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const authApiBase = getAuthApiBase();
  const url = `${authApiBase}${normalizedEndpoint}`;

  console.log('authFetch:', {
    endpoint,
    normalizedEndpoint,
    AUTH_API_BASE: authApiBase,
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

};
