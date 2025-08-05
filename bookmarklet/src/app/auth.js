/**
 * Simplified OAuth authentication for bookmarklet
 * Uses popup window and postMessage for clean OAuth flow
 */

class FigtreeAuth {
  constructor(storage) {
    this.storage = storage;
    this.clientId = 'qTujZ7BNoSdMdVikl3RaeD';
    this.scopes = 'files:read';
    this.redirectUri = 'https://www.getfigtree.com/oauth.html';
    this.baseUrl = 'https://www.figma.com/oauth';
    this.tokenUrl = 'https://api.figma.com/v1/oauth/token';
    
    this.currentPopup = null;
    this.authPromise = null;
    
    // Listen for messages from OAuth popup
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener('message', this.handleMessage);
  }

  /**
   * Get stored access token
   * @returns {Promise<string|null>}
   */
  async getAccessToken() {
    const result = await this.storage.get(['figma_access_token', 'token_expires_at']);
    const token = result.figma_access_token;
    const expiresAt = result.token_expires_at;
    
    if (!token) {
      return null;
    }
    
    // Check if token is expired (if we have expiration info)
    if (expiresAt && Date.now() > expiresAt) {
      await this.storage.remove(['figma_access_token', 'token_expires_at']);
      return null;
    }
    
    return token;
  }

  /**
   * Verify if current token is valid
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async verifyToken(token) {
    try {
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('[Figtree Auth] Token verification failed:', error);
      return false;
    }
  }

  /**
   * Start OAuth flow
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    // If already authenticating, return existing promise
    if (this.authPromise) {
      return this.authPromise;
    }
    
    // Check for existing valid token
    const existingToken = await this.getAccessToken();
    if (existingToken && await this.verifyToken(existingToken)) {
      return existingToken;
    }
    
    this.authPromise = this.startOAuthFlow();
    
    try {
      const token = await this.authPromise;
      return token;
    } finally {
      this.authPromise = null;
    }
  }

  /**
   * Start the OAuth flow with popup
   * @returns {Promise<string>}
   */
  async startOAuthFlow() {
    return new Promise((resolve, reject) => {
      const state = this.generateState();
      const authUrl = this.buildAuthUrl(state);
      
      // Store state for verification
      this.currentState = state;
      this.authResolve = resolve;
      this.authReject = reject;
      
      // Open popup window
      const popup = window.open(
        authUrl,
        'figtree-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }
      
      this.currentPopup = popup;
      
      // Poll popup status
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          if (this.authReject) {
            this.authReject(new Error('Authentication cancelled by user'));
            this.cleanup();
          }
        }
      }, 1000);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close();
        }
        clearInterval(pollTimer);
        if (this.authReject) {
          this.authReject(new Error('Authentication timeout'));
          this.cleanup();
        }
      }, 300000);
    });
  }

  /**
   * Handle messages from OAuth popup
   * @param {MessageEvent} event
   */
  async handleMessage(event) {
    // Verify origin for security
    if (event.origin !== 'https://www.getfigtree.com') {
      return;
    }
    
    const data = event.data;
    
    if (data.type === 'FIGTREE_OAUTH_SUCCESS') {
      const { code, state } = data;
      
      // Verify state parameter
      if (state !== this.currentState) {
        if (this.authReject) {
          this.authReject(new Error('Invalid state parameter - possible CSRF attack'));
        }
        return;
      }
      
      try {
        // Exchange code for token
        const token = await this.exchangeCodeForToken(code);
        
        // Store token
        await this.storage.set({
          figma_access_token: token,
          token_expires_at: Date.now() + (3600 * 1000) // 1 hour from now
        });
        
        if (this.authResolve) {
          this.authResolve(token);
        }
      } catch (error) {
        if (this.authReject) {
          this.authReject(error);
        }
      } finally {
        this.cleanup();
      }
    } else if (data.type === 'FIGTREE_OAUTH_ERROR') {
      if (this.authReject) {
        this.authReject(new Error(data.error || 'OAuth error'));
      }
      this.cleanup();
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code
   * @returns {Promise<string>}
   */
  async exchangeCodeForToken(code) {
    // For bookmarklets, we'll use the external service since we can't store client_secret
    const response = await fetch('https://www.getfigtree.com/server/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  }

  /**
   * Build OAuth authorization URL
   * @param {string} state
   * @returns {string}
   */
  buildAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      response_type: 'code',
      state: state
    });
    
    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Generate random state string for OAuth security
   * @returns {string}
   */
  generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clean up authentication state
   */
  cleanup() {
    if (this.currentPopup && !this.currentPopup.closed) {
      this.currentPopup.close();
    }
    
    this.currentPopup = null;
    this.currentState = null;
    this.authResolve = null;
    this.authReject = null;
  }

  /**
   * Sign out and clear stored token
   * @returns {Promise<void>}
   */
  async signOut() {
    await this.storage.remove(['figma_access_token', 'token_expires_at']);
    this.cleanup();
  }

  /**
   * Get current user info
   * @returns {Promise<Object|null>}
   */
  async getCurrentUser() {
    const token = await this.getAccessToken();
    if (!token) {
      return null;
    }
    
    try {
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('[Figtree Auth] Failed to get user info:', error);
      return null;
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    window.removeEventListener('message', this.handleMessage);
    this.cleanup();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FigtreeAuth;
} else {
  window.FigtreeAuth = FigtreeAuth;
}