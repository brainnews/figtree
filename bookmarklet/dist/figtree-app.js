/**
 * Figtree Bookmarklet v2.0.0-bookmarklet
 * Quick access to your Figma projects from any webpage
 * 
 * Built: 2025-08-05T02:23:05.690Z
 * Source: https://github.com/your-username/figtree
 */

(function() {
  'use strict';
  

  // === app/storage.js ===
/**
 * Storage abstraction layer for the bookmarklet
 * Replaces Chrome extension storage APIs with localStorage
 */

class FigtreeStorage {
  constructor() {
    this.prefix = 'figtree_';
    this.version = '2.0.0';
    this.migrate();
  }

  /**
   * Migrate from Chrome extension storage format if needed
   */
  migrate() {
    const versionKey = this.prefix + 'version';
    const currentVersion = localStorage.getItem(versionKey);
    
    if (!currentVersion) {
      // First time running bookmarklet version
      localStorage.setItem(versionKey, this.version);
      console.log('[Figtree Storage] Initialized bookmarklet storage');
    }
  }

  /**
   * Get data from localStorage
   * @param {string|Array} keys - Key or array of keys to retrieve
   * @returns {Promise<Object>} - Promise resolving to object with requested data
   */
  async get(keys) {
    return new Promise((resolve) => {
      const result = {};
      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      keyArray.forEach(key => {
        const storageKey = this.prefix + key;
        const value = localStorage.getItem(storageKey);
        
        if (value !== null) {
          try {
            result[key] = JSON.parse(value);
          } catch (e) {
            // If JSON parsing fails, return as string
            result[key] = value;
          }
        }
      });
      
      resolve(result);
    });
  }

  /**
   * Set data in localStorage
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  async set(items) {
    return new Promise((resolve) => {
      Object.entries(items).forEach(([key, value]) => {
        const storageKey = this.prefix + key;
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(storageKey, serializedValue);
      });
      resolve();
    });
  }

  /**
   * Remove data from localStorage
   * @param {string|Array} keys - Key or array of keys to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return new Promise((resolve) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      keyArray.forEach(key => {
        const storageKey = this.prefix + key;
        localStorage.removeItem(storageKey);
      });
      
      resolve();
    });
  }

  /**
   * Clear all Figtree data from localStorage
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve) => {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      resolve();
    });
  }

  /**
   * Get storage usage information
   * @returns {Object} Storage usage stats
   */
  getStorageInfo() {
    let totalSize = 0;
    let itemCount = 0;
    const items = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        const cleanKey = key.replace(this.prefix, '');
        
        items[cleanKey] = {
          size: size,
          sizeFormatted: this.formatBytes(size)
        };
        
        totalSize += size;
        itemCount++;
      }
    }
    
    // Estimate localStorage limit (usually 5-10MB)
    const estimatedLimit = 5 * 1024 * 1024; // 5MB
    const usagePercent = Math.round((totalSize / estimatedLimit) * 100);
    
    return {
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      itemCount,
      usagePercent,
      estimatedLimit: this.formatBytes(estimatedLimit),
      items
    };
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Export all data for backup
   * @returns {Promise<Object>} All stored data
   */
  async exportData() {
    const allKeys = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        allKeys.push(key.replace(this.prefix, ''));
      }
    }
    
    return await this.get(allKeys);
  }

  /**
   * Import data from backup
   * @param {Object} data - Data to import
   * @returns {Promise<void>}
   */
  async importData(data) {
    await this.set(data);
  }
}

// Create singleton instance
const figtreeStorage = new FigtreeStorage();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = figtreeStorage;
} else {
  window.FigtreeStorage = figtreeStorage;
}

  // === app/auth.js ===
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

  // === app/figma-api.js ===
/**
 * Figma API integration for bookmarklet
 * Handles all Figma API calls with proper error handling
 */

class FigtreeAPI {
  constructor(auth) {
    this.auth = auth;
    this.baseUrl = 'https://api.figma.com/v1';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async makeRequest(endpoint, options = {}) {
    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed: ${response.status}`;
      
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication expired. Please reconnect to Figma.';
          // Clear invalid token
          await this.auth.signOut();
          break;
        case 403:
          errorMessage = 'Access denied. You may not have permission to view this resource.';
          break;
        case 404:
          errorMessage = 'Resource not found. Please check if the file or node exists.';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Figma service is temporarily unavailable. Please try again later.';
          break;
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  }

  /**
   * Get current user information
   * @returns {Promise<Object>}
   */
  async getCurrentUser() {
    const cacheKey = 'user_me';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    const user = await this.makeRequest('/me');
    this.setCache(cacheKey, user);
    return user;
  }

  /**
   * Get file information
   * @param {string} fileKey
   * @returns {Promise<Object>}
   */
  async getFile(fileKey) {
    const cacheKey = `file_${fileKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    const file = await this.makeRequest(`/files/${fileKey}`);
    this.setCache(cacheKey, file);
    return file;
  }

  /**
   * Get specific nodes from a file
   * @param {string} fileKey
   * @param {Array<string>} nodeIds
   * @returns {Promise<Object>}
   */
  async getNodes(fileKey, nodeIds) {
    const cacheKey = `nodes_${fileKey}_${nodeIds.sort().join(',')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    const nodes = await this.makeRequest(`/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`);
    this.setCache(cacheKey, nodes);
    return nodes;
  }

  /**
   * Get images for nodes
   * @param {string} fileKey
   * @param {Array<string>} nodeIds
   * @param {Object} options - Image options (format, scale, etc.)
   * @returns {Promise<Object>}
   */
  async getImages(fileKey, nodeIds, options = {}) {
    const params = new URLSearchParams({
      ids: nodeIds.join(','),
      format: options.format || 'png',
      scale: options.scale || '1',
      ...options
    });
    
    const cacheKey = `images_${fileKey}_${params.toString()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    const images = await this.makeRequest(`/images/${fileKey}?${params.toString()}`);
    this.setCache(cacheKey, images, 60 * 60 * 1000); // Cache images for 1 hour
    return images;
  }

  /**
   * Parse file key from Figma URL
   * @param {string} url
   * @returns {string|null}
   */
  parseFileKey(url) {
    try {
      const figmaUrl = new URL(url);
      if (!figmaUrl.hostname.includes('figma.com')) return null;
      
      const fileMatch = figmaUrl.pathname.match(/(?:file|design)\/(.*?)(\/.*)?$/);
      return fileMatch ? fileMatch[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Figma URL for a node
   * @param {string} fileKey
   * @param {string} nodeId
   * @returns {string}
   */
  buildNodeUrl(fileKey, nodeId = null) {
    let url = `https://www.figma.com/file/${fileKey}`;
    if (nodeId) {
      url += `?node-id=${nodeId}`;
    }
    return url;
  }

  /**
   * Check if a node has a "fignore" child layer
   * @param {Object} node
   * @returns {boolean}
   */
  hasFignoreLayer(node) {
    if (!node.children) return false;
    return node.children.some(child => child.name === "fignore");
  }

  /**
   * Filter nodes by type and fignore status
   * @param {Array} nodes
   * @param {string} type - Node type to filter by
   * @param {boolean} excludeFignore - Whether to exclude nodes with fignore layers
   * @returns {Array}
   */
  filterNodes(nodes, type = null, excludeFignore = true) {
    if (!Array.isArray(nodes)) return [];
    
    return nodes.filter(node => {
      // Filter by type if specified
      if (type && node.type !== type) return false;
      
      // Filter out fignore nodes if requested
      if (excludeFignore && this.hasFignoreLayer(node)) return false;
      
      return true;
    });
  }

  /**
   * Get project pages with frames
   * @param {string} fileKey
   * @returns {Promise<Array>}
   */
  async getProjectPages(fileKey) {
    const file = await this.getFile(fileKey);
    const pages = file.document.children || [];
    
    // Get detailed node information for all pages
    const pageIds = pages.map(page => page.id);
    if (pageIds.length === 0) return [];
    
    const nodesResponse = await this.getNodes(fileKey, pageIds);
    
    return pages.map(page => {
      const pageNode = nodesResponse.nodes[page.id];
      return {
        ...page,
        children: pageNode?.document?.children || []
      };
    });
  }

  /**
   * Get frames for a specific page
   * @param {string} fileKey
   * @param {string} pageId
   * @returns {Promise<Array>}
   */
  async getPageFrames(fileKey, pageId) {
    const nodesResponse = await this.getNodes(fileKey, [pageId]);
    const pageNode = nodesResponse.nodes[pageId];
    
    if (!pageNode?.document?.children) return [];
    
    // Filter and reverse frames (newest first)
    const frames = this.filterNodes(pageNode.document.children, 'FRAME', true);
    return frames.reverse();
  }

  /**
   * Get groups within a frame
   * @param {string} fileKey
   * @param {string} frameId
   * @returns {Promise<Array>}
   */
  async getFrameGroups(fileKey, frameId) {
    const nodesResponse = await this.getNodes(fileKey, [frameId]);
    const frameNode = nodesResponse.nodes[frameId];
    
    if (!frameNode?.document?.children) return [];
    
    return this.filterNodes(frameNode.document.children, 'GROUP', true);
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > (cached.timeout || this.cacheTimeout)) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data, timeout = null) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout: timeout || this.cacheTimeout
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > (entry.timeout || this.cacheTimeout)) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      hitRatio: this.hitRatio || 0
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > (entry.timeout || this.cacheTimeout)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FigtreeAPI;
} else {
  window.FigtreeAPI = FigtreeAPI;
}

  // === app/main.js ===
/**
 * Main Figtree Bookmarklet Application
 * Adapted from the Chrome extension content script
 */

class FigtreeApp {
  constructor() {
    this.storage = window.FigtreeStorage;
    this.auth = new window.FigtreeAuth(this.storage);
    this.api = new window.FigtreeAPI(this.auth);
    this.ui = null;
    
    this.state = {
      isOpen: false,
      projects: [],
      pinnedItems: [],
      searchTerm: '',
      loading: false
    };
    
    this.nodeCache = new Map();
    
    // Bind methods
    this.init = this.init.bind(this);
    this.toggle = this.toggle.bind(this);
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('[Figtree] Initializing bookmarklet app');
    
    try {
      // Load stored data
      await this.loadStoredData();
      
      // Check authentication status
      const user = await this.auth.getCurrentUser();
      if (user) {
        console.log('[Figtree] User authenticated:', user.email);
        await this.show();
      } else {
        console.log('[Figtree] User not authenticated, starting auth flow');
        await this.authenticate();
      }
    } catch (error) {
      console.error('[Figtree] Initialization failed:', error);
      this.showError('Failed to initialize Figtree: ' + error.message);
    }
  }

  /**
   * Toggle the UI panel
   */
  async toggle() {
    if (this.state.isOpen) {
      this.hide();
    } else {
      await this.show();
    }
  }

  /**
   * Show the UI panel
   */
  async show() {
    if (this.state.isOpen) return;
    
    try {
      // Ensure user is authenticated
      const token = await this.auth.getAccessToken();
      if (!token) {
        await this.authenticate();
        return;
      }
      
      // Create UI if it doesn't exist
      if (!this.ui) {
        this.ui = this.createUI();
      }
      
      this.state.isOpen = true;
      
      // Load projects if not already loaded
      if (this.state.projects.length === 0) {
        await this.loadProjects();
      }
      
      this.renderProjects();
      
    } catch (error) {
      console.error('[Figtree] Failed to show panel:', error);
      this.showError('Failed to show Figtree panel: ' + error.message);
    }
  }

  /**
   * Hide the UI panel
   */
  hide() {
    if (!this.state.isOpen || !this.ui) return;
    
    this.ui.remove();
    this.ui = null;
    this.state.isOpen = false;
  }

  /**
   * Authenticate user
   */
  async authenticate() {
    try {
      this.showLoading('Authenticating with Figma...');
      const token = await this.auth.authenticate();
      
      if (token) {
        const user = await this.auth.getCurrentUser();
        console.log('[Figtree] Authentication successful:', user?.email);
        await this.show();
      }
    } catch (error) {
      console.error('[Figtree] Authentication failed:', error);
      this.showError('Authentication failed: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Load stored data from localStorage
   */
  async loadStoredData() {
    const data = await this.storage.get(['figmaProjects', 'pinnedItems']);
    this.state.projects = data.figmaProjects || [];
    this.state.pinnedItems = data.pinnedItems || [];
  }

  /**
   * Load projects from Figma API
   */
  async loadProjects() {
    try {
      this.state.loading = true;
      this.updateLoadingState();
      
      // Validate and load each stored project
      const validProjects = [];
      
      for (const project of this.state.projects) {
        try {
          const fileData = await this.api.getFile(project.key);
          validProjects.push({
            key: project.key,
            name: fileData.name,
            lastModified: fileData.lastModified || project.lastModified
          });
        } catch (error) {
          console.warn(`[Figtree] Failed to load project ${project.key}:`, error);
          // Keep project in list but mark as unavailable
          validProjects.push({
            ...project,
            error: error.message
          });
        }
      }
      
      this.state.projects = validProjects;
      await this.storage.set({ figmaProjects: validProjects });
      
    } catch (error) {
      console.error('[Figtree] Failed to load projects:', error);
      this.showError('Failed to load projects: ' + error.message);
    } finally {
      this.state.loading = false;
      this.updateLoadingState();
    }
  }

  /**
   * Add a new project by URL
   */
  async addProject(url) {
    const fileKey = this.api.parseFileKey(url);
    if (!fileKey) {
      throw new Error('Invalid Figma URL');
    }
    
    // Check if project already exists
    if (this.state.projects.some(p => p.key === fileKey)) {
      throw new Error('Project already added');
    }
    
    try {
      // Verify the file exists and get its data
      const fileData = await this.api.getFile(fileKey);
      
      const project = {
        key: fileKey,
        name: fileData.name,
        lastModified: fileData.lastModified,
        addedAt: Date.now()
      };
      
      this.state.projects.push(project);
      await this.storage.set({ figmaProjects: this.state.projects });
      
      this.renderProjects();
      this.showSuccess('Project added successfully');
      
      return project;
    } catch (error) {
      console.error('[Figtree] Failed to add project:', error);
      throw error;
    }
  }

  /**
   * Remove a project
   */
  async removeProject(fileKey) {
    this.state.projects = this.state.projects.filter(p => p.key !== fileKey);
    await this.storage.set({ figmaProjects: this.state.projects });
    
    // Clear related cache
    this.nodeCache.delete(fileKey);
    
    this.renderProjects();
    this.showSuccess('Project removed');
  }

  /**
   * Pin an item
   */
  async pinItem(url, title, preview = null) {
    // Check if already pinned
    if (this.state.pinnedItems.some(item => item.url === url)) {
      return;
    }
    
    const pinnedItem = {
      url,
      title,
      preview,
      pinnedAt: Date.now()
    };
    
    this.state.pinnedItems.push(pinnedItem);
    await this.storage.set({ pinnedItems: this.state.pinnedItems });
    
    this.updatePinnedItemsDisplay();
  }

  /**
   * Unpin an item
   */
  async unpinItem(url) {
    this.state.pinnedItems = this.state.pinnedItems.filter(item => item.url !== url);
    await this.storage.set({ pinnedItems: this.state.pinnedItems });
    
    this.updatePinnedItemsDisplay();
    this.updatePinButtonStates();
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }

  /**
   * Show loading indicator
   */
  showLoading(message = 'Loading...') {
    const existing = document.querySelector('#figtree-global-loading');
    if (existing) existing.remove();
    
    const loading = document.createElement('div');
    loading.id = 'figtree-global-loading';
    loading.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2c2c2c;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 16px;
          height: 16px;
          border: 2px solid #666;
          border-top: 2px solid #0D99FF;
          border-radius: 50%;
          animation: figtree-spin 1s linear infinite;
        "></div>
        ${message}
      </div>
      <style>
        @keyframes figtree-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loading);
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loading = document.querySelector('#figtree-global-loading');
    if (loading) loading.remove();
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const colors = {
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      info: '#007AFF'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      z-index: 1000000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: figtree-slide-in 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes figtree-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'figtree-slide-in 0.3s ease-out reverse';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
        if (style.parentNode) style.remove();
      }, 300);
    }, 4000);
  }

  /**
   * Update loading state in UI
   */
  updateLoadingState() {
    if (!this.ui) return;
    
    const projectsContainer = this.ui.querySelector('.figtree-projects');
    if (!projectsContainer) return;
    
    if (this.state.loading) {
      projectsContainer.innerHTML = `
        <div class="figtree-loading-item">
          <div style="display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.6);">
            <div style="width: 16px; height: 16px; border: 2px solid #666; border-top: 2px solid #0D99FF; border-radius: 50%; animation: figtree-spin 1s linear infinite;"></div>
            Loading projects...
          </div>
        </div>
      `;
    }
  }

  /**
   * Update pinned items display
   */
  updatePinnedItemsDisplay() {
    if (!this.ui) return;
    
    const pinnedContent = this.ui.querySelector('.figtree-pinned-content');
    if (!pinnedContent) return;
    
    if (this.state.pinnedItems.length === 0) {
      pinnedContent.innerHTML = '<div class="figtree-empty">No pinned items</div>';
      return;
    }
    
    pinnedContent.innerHTML = this.state.pinnedItems.map(item => `
      <div class="figtree-pinned-item" data-url="${item.url}">
        <div class="figtree-pinned-info">
          ${item.preview ? `<img src="${item.preview}" alt="" class="figtree-pinned-preview">` : ''}
          <span class="figtree-pinned-title">${item.title}</span>
        </div>
        <div class="figtree-pinned-actions">
          <button class="figtree-pinned-copy" title="Copy link">📋</button>
          <button class="figtree-pinned-unpin" title="Unpin">📌</button>
        </div>
      </div>
    `).join('');
    
    // Add event listeners for pinned items
    this.addPinnedItemListeners();
  }

  /**
   * Update pin button states
   */
  updatePinButtonStates() {
    if (!this.ui) return;
    
    const pinButtons = this.ui.querySelectorAll('.figtree-pin-btn');
    pinButtons.forEach(button => {
      const url = button.dataset.url;
      const isPinned = this.state.pinnedItems.some(item => item.url === url);
      button.classList.toggle('pinned', isPinned);
    });
  }

  /**
   * Render projects in the UI
   */
  renderProjects() {
    if (!this.ui) return;
    
    const projectsContainer = this.ui.querySelector('.figtree-projects');
    if (!projectsContainer) return;
    
    if (this.state.projects.length === 0) {
      projectsContainer.innerHTML = `
        <div class="figtree-empty" style="text-align: center; padding: 20px; color: rgba(255,255,255,0.6);">
          <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
          <div>No projects found</div>
          <div style="font-size: 12px; margin-top: 8px;">Add a Figma project URL above to get started</div>
        </div>
      `;
      return;
    }
    
    projectsContainer.innerHTML = this.state.projects.map(project => this.renderProject(project)).join('');
    this.addProjectListeners();
  }

  // We'll continue with the UI creation and event handlers in the next part...
  
  /**
   * Cleanup when app is destroyed
   */
  destroy() {
    this.hide();
    this.auth.destroy();
    this.api.clearCache();
  }
}

// Initialize when script loads
window.FigtreeApp = new FigtreeApp();

  // === ui/panel.js ===
/**
 * UI Panel creation and management for Figtree bookmarklet
 * Adapted from the Chrome extension content script
 */

// Extend the main app with UI functionality
window.FigtreeApp.prototype.createUI = function() {
  // Remove any existing panel
  const existing = document.querySelector('#figtree-panel');
  if (existing) existing.remove();
  
  const panel = document.createElement('div');
  panel.id = 'figtree-panel';
  panel.className = 'figtree-container';
  
  // Create the main UI structure
  panel.innerHTML = `
    <div class="figtree-header">
      <div class="figtree-logo">🌳</div>
      <span class="figtree-title">Figtree</span>
      <div class="figtree-header-actions">
        <button class="figtree-settings-btn" title="Settings">⚙️</button>
        <button class="figtree-minimize-btn" title="Minimize">−</button>
        <button class="figtree-close-btn" title="Close">×</button>
      </div>
    </div>
    
    <div class="figtree-content">
      <div class="figtree-add-project">
        <input type="text" class="figtree-url-input" placeholder="Add Figma project by URL" />
        <button class="figtree-add-btn" title="Add project">+</button>
      </div>
      
      <div class="figtree-search">
        <input type="text" class="figtree-search-input" placeholder="Search projects..." />
        <button class="figtree-search-clear" title="Clear search" style="display: none;">×</button>
      </div>
      
      <div class="figtree-pinned">
        <div class="figtree-pinned-header">
          <span>📌 Pinned</span>
          <button class="figtree-pinned-toggle">▲</button>
        </div>
        <div class="figtree-pinned-content"></div>
      </div>
      
      <div class="figtree-projects"></div>
    </div>
    
    <div class="figtree-settings" style="display: none;">
      <div class="figtree-settings-header">
        <h3>Settings</h3>
        <button class="figtree-settings-close">×</button>
      </div>
      <div class="figtree-settings-content">
        <div class="figtree-settings-section">
          <h4>Data Management</h4>
          <button class="figtree-clear-pinned">Clear Pinned Items</button>
          <button class="figtree-clear-projects">Remove All Projects</button>
          <button class="figtree-clear-cache">Clear Cache</button>
          <button class="figtree-clear-all">Clear All Data</button>
        </div>
        <div class="figtree-settings-section">
          <h4>Account</h4>
          <button class="figtree-sign-out">Sign Out</button>
        </div>
        <div class="figtree-settings-section">
          <h4>Storage Info</h4>
          <div class="figtree-storage-info">
            <div>Loading storage info...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add the comprehensive styles
  this.addStyles();
  
  // Make panel draggable
  this.makeDraggable(panel);
  
  // Add all event listeners
  this.addEventListeners(panel);
  
  // Add to document
  document.body.appendChild(panel);
  
  // Update pinned items display
  this.updatePinnedItemsDisplay();
  
  return panel;
};

// Add comprehensive styles
window.FigtreeApp.prototype.addStyles = function() {
  if (document.querySelector('#figtree-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'figtree-styles';
  style.textContent = `
    .figtree-container {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      width: 320px !important;
      max-height: 80vh !important;
      background: #2c2c2c !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      color: #fff !important;
      border: 1px solid #3d3d3d !important;
      backdrop-filter: blur(20px) !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      user-select: none !important;
    }
    
    .figtree-container * {
      box-sizing: border-box !important;
    }
    
    .figtree-header {
      display: flex !important;
      align-items: center !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
      cursor: move !important;
      gap: 8px !important;
    }
    
    .figtree-logo {
      font-size: 20px !important;
      line-height: 1 !important;
    }
    
    .figtree-title {
      font-size: 16px !important;
      font-weight: 600 !important;
      flex-grow: 1 !important;
      margin: 0 !important;
    }
    
    .figtree-header-actions {
      display: flex !important;
      gap: 4px !important;
    }
    
    .figtree-header-actions button {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.6) !important;
      cursor: pointer !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      font-size: 14px !important;
      transition: all 0.2s !important;
    }
    
    .figtree-header-actions button:hover {
      background: rgba(255,255,255,0.1) !important;
      color: rgba(255,255,255,1) !important;
    }
    
    .figtree-content {
      flex: 1 !important;
      overflow-y: auto !important;
      display: flex !important;
      flex-direction: column !important;
    }
    
    .figtree-add-project {
      display: flex !important;
      gap: 8px !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    
    .figtree-url-input {
      flex: 1 !important;
      background: rgba(255,255,255,0.1) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 6px !important;
      padding: 8px 12px !important;
      color: #fff !important;
      font-size: 14px !important;
      outline: none !important;
    }
    
    .figtree-url-input:focus {
      border-color: #0D99FF !important;
      box-shadow: 0 0 0 2px rgba(13,153,255,0.2) !important;
    }
    
    .figtree-url-input::placeholder {
      color: rgba(255,255,255,0.4) !important;
    }
    
    .figtree-add-btn {
      background: #0D99FF !important;
      border: none !important;
      border-radius: 6px !important;
      color: white !important;
      cursor: pointer !important;
      font-size: 16px !important;
      font-weight: bold !important;
      padding: 8px 12px !important;
      transition: background 0.2s !important;
    }
    
    .figtree-add-btn:hover {
      background: #0B87E0 !important;
    }
    
    .figtree-add-btn:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
    }
    
    .figtree-search {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    
    .figtree-search-input {
      flex: 1 !important;
      background: transparent !important;
      border: none !important;
      color: #fff !important;
      font-size: 14px !important;
      outline: none !important;
      padding: 4px 0 !important;
    }
    
    .figtree-search-input::placeholder {
      color: rgba(255,255,255,0.4) !important;
    }
    
    .figtree-search-clear {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.5) !important;
      cursor: pointer !important;
      font-size: 16px !important;
      padding: 4px !important;
      border-radius: 4px !important;
    }
    
    .figtree-search-clear:hover {
      background: rgba(255,255,255,0.1) !important;
      color: rgba(255,255,255,0.8) !important;
    }
    
    .figtree-pinned {
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    
    .figtree-pinned-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 16px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      color: rgba(255,255,255,0.8) !important;
    }
    
    .figtree-pinned-header:hover {
      background: rgba(255,255,255,0.05) !important;
    }
    
    .figtree-pinned-toggle {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.5) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      padding: 4px !important;
      transition: all 0.2s !important;
    }
    
    .figtree-pinned.collapsed .figtree-pinned-toggle {
      transform: rotate(180deg) !important;
    }
    
    .figtree-pinned.collapsed .figtree-pinned-content {
      display: none !important;
    }
    
    .figtree-pinned-content {
      max-height: 200px !important;
      overflow-y: auto !important;
    }
    
    .figtree-pinned-item {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 8px 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.05) !important;
      transition: background 0.2s !important;
    }
    
    .figtree-pinned-item:hover {
      background: rgba(255,255,255,0.05) !important;
    }
    
    .figtree-pinned-info {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      flex: 1 !important;
      min-width: 0 !important;
    }
    
    .figtree-pinned-preview {
      width: 24px !important;
      height: 24px !important;
      border-radius: 4px !important;
      object-fit: cover !important;
      background: rgba(255,255,255,0.1) !important;
    }
    
    .figtree-pinned-title {
      font-size: 13px !important;
      color: rgba(255,255,255,0.8) !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    
    .figtree-pinned-actions {
      display: flex !important;
      gap: 4px !important;
      opacity: 0 !important;
      transition: opacity 0.2s !important;
    }
    
    .figtree-pinned-item:hover .figtree-pinned-actions {
      opacity: 1 !important;
    }
    
    .figtree-pinned-actions button {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.5) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      padding: 4px !important;
      border-radius: 3px !important;
      transition: all 0.2s !important;
    }
    
    .figtree-pinned-actions button:hover {
      background: rgba(255,255,255,0.1) !important;
      color: rgba(255,255,255,0.8) !important;
    }
    
    .figtree-projects {
      flex: 1 !important;
      overflow-y: auto !important;
      padding: 8px 0 !important;
    }
    
    .figtree-project {
      margin: 4px 0 !important;
    }
    
    .figtree-project-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 8px 16px !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    }
    
    .figtree-project-header:hover {
      background: rgba(255,255,255,0.05) !important;
    }
    
    .figtree-project-name {
      font-size: 14px !important;
      font-weight: 500 !important;
      color: rgba(255,255,255,0.9) !important;
      flex: 1 !important;
      margin: 0 !important;
    }
    
    .figtree-project-actions {
      display: flex !important;
      gap: 4px !important;
      opacity: 0 !important;
      transition: opacity 0.2s !important;
    }
    
    .figtree-project-header:hover .figtree-project-actions {
      opacity: 1 !important;
    }
    
    .figtree-project-actions button {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.5) !important;
      cursor: pointer !important;
      font-size: 12px !important;
      padding: 4px 6px !important;
      border-radius: 3px !important;
      transition: all 0.2s !important;
    }
    
    .figtree-project-actions button:hover {
      background: rgba(255,255,255,0.1) !important;
      color: rgba(255,255,255,0.8) !important;
    }
    
    .figtree-pin-btn.pinned {
      color: #FFD700 !important;
    }
    
    .figtree-copy-btn.copied {
      color: #34C759 !important;
    }
    
    .figtree-empty {
      text-align: center !important;
      padding: 20px !important;
      color: rgba(255,255,255,0.6) !important;
      font-size: 14px !important;
    }
    
    .figtree-loading-item {
      padding: 16px !important;
      color: rgba(255,255,255,0.6) !important;
      font-size: 14px !important;
    }
    
    .figtree-settings {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: #2c2c2c !important;
      border-radius: 12px !important;
      display: flex !important;
      flex-direction: column !important;
    }
    
    .figtree-settings-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    
    .figtree-settings-header h3 {
      margin: 0 !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #fff !important;
    }
    
    .figtree-settings-close {
      background: none !important;
      border: none !important;
      color: rgba(255,255,255,0.6) !important;
      cursor: pointer !important;
      font-size: 18px !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
    }
    
    .figtree-settings-close:hover {
      background: rgba(255,255,255,0.1) !important;
      color: rgba(255,255,255,1) !important;
    }
    
    .figtree-settings-content {
      flex: 1 !important;
      overflow-y: auto !important;
      padding: 16px !important;
    }
    
    .figtree-settings-section {
      margin-bottom: 24px !important;
    }
    
    .figtree-settings-section h4 {
      margin: 0 0 12px 0 !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      color: rgba(255,255,255,0.9) !important;
    }
    
    .figtree-settings-section button {
      background: rgba(255,255,255,0.1) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 6px !important;
      color: #fff !important;
      cursor: pointer !important;
      display: block !important;
      font-size: 14px !important;
      margin-bottom: 8px !important;
      padding: 8px 12px !important;
      text-align: left !important;
      transition: all 0.2s !important;
      width: 100% !important;
    }
    
    .figtree-settings-section button:hover {
      background: rgba(255,255,255,0.15) !important;
    }
    
    .figtree-clear-all {
      background: rgba(255,59,48,0.2) !important;
      border-color: rgba(255,59,48,0.4) !important;
    }
    
    .figtree-clear-all:hover {
      background: rgba(255,59,48,0.3) !important;
    }
    
    .figtree-storage-info {
      background: rgba(255,255,255,0.05) !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      padding: 12px !important;
      color: rgba(255,255,255,0.7) !important;
      line-height: 1.4 !important;
    }
    
    .figtree-container.minimized .figtree-content {
      display: none !important;
    }
    
    .figtree-container.minimized .figtree-settings {
      display: none !important;
    }
    
    @keyframes figtree-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
};

// Make panel draggable
window.FigtreeApp.prototype.makeDraggable = function(panel) {
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;
  let xOffset = 0;
  let yOffset = 0;
  
  const header = panel.querySelector('.figtree-header');
  
  const dragStart = (e) => {
    if (e.target.closest('button')) return;
    
    if (e.type === "touchstart") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
    } else {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }
    
    isDragging = true;
    panel.style.cursor = 'grabbing';
  };
  
  const dragEnd = () => {
    if (!isDragging) return;
    
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    panel.style.cursor = '';
  };
  
  const drag = (e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX - initialX;
      currentY = e.touches[0].clientY - initialY;
    } else {
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
    }
    
    const rect = panel.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    xOffset = Math.min(Math.max(currentX, 0), maxX);
    yOffset = Math.min(Math.max(currentY, 0), maxY);
    
    panel.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  };
  
  header.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);
  
  header.addEventListener("touchstart", dragStart);
  document.addEventListener("touchmove", drag);
  document.addEventListener("touchend", dragEnd);
};

  // === ui/events.js ===
/**
 * Event handlers for the Figtree bookmarklet UI
 */

// Add event listeners to the panel
window.FigtreeApp.prototype.addEventListeners = function(panel) {
  // Header actions
  const minimizeBtn = panel.querySelector('.figtree-minimize-btn');
  const closeBtn = panel.querySelector('.figtree-close-btn');
  const settingsBtn = panel.querySelector('.figtree-settings-btn');
  
  minimizeBtn.addEventListener('click', () => {
    panel.classList.toggle('minimized');
  });
  
  closeBtn.addEventListener('click', () => {
    this.hide();
  });
  
  settingsBtn.addEventListener('click', () => {
    this.toggleSettings();
  });
  
  // Add project functionality
  const urlInput = panel.querySelector('.figtree-url-input');
  const addBtn = panel.querySelector('.figtree-add-btn');
  
  const handleAddProject = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    
    addBtn.disabled = true;
    addBtn.textContent = '⏳';
    
    try {
      await this.addProject(url);
      urlInput.value = '';
    } catch (error) {
      this.showError(error.message);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = '+';
    }
  };
  
  addBtn.addEventListener('click', handleAddProject);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddProject();
  });
  
  // Search functionality
  const searchInput = panel.querySelector('.figtree-search-input');
  const searchClear = panel.querySelector('.figtree-search-clear');
  
  searchInput.addEventListener('input', (e) => {
    this.state.searchTerm = e.target.value.toLowerCase();
    searchClear.style.display = e.target.value ? 'block' : 'none';
    this.filterProjects();
  });
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    this.state.searchTerm = '';
    searchClear.style.display = 'none';
    this.filterProjects();
  });
  
  // Pinned items toggle
  const pinnedHeader = panel.querySelector('.figtree-pinned-header');
  const pinnedToggle = panel.querySelector('.figtree-pinned-toggle');
  const pinnedSection = panel.querySelector('.figtree-pinned');
  
  pinnedHeader.addEventListener('click', () => {
    pinnedSection.classList.toggle('collapsed');
  });
  
  // Settings panel
  const settingsPanel = panel.querySelector('.figtree-settings');
  const settingsClose = panel.querySelector('.figtree-settings-close');
  
  settingsClose.addEventListener('click', () => {
    this.hideSettings();
  });
  
  // Settings actions
  const clearPinnedBtn = panel.querySelector('.figtree-clear-pinned');
  const clearProjectsBtn = panel.querySelector('.figtree-clear-projects');
  const clearCacheBtn = panel.querySelector('.figtree-clear-cache');
  const clearAllBtn = panel.querySelector('.figtree-clear-all');
  const signOutBtn = panel.querySelector('.figtree-sign-out');
  
  clearPinnedBtn.addEventListener('click', () => this.clearPinnedItems());
  clearProjectsBtn.addEventListener('click', () => this.clearProjects());
  clearCacheBtn.addEventListener('click', () => this.clearCache());
  clearAllBtn.addEventListener('click', () => this.clearAllData());
  signOutBtn.addEventListener('click', () => this.signOut());
  
  // Update storage info when settings are shown
  settingsBtn.addEventListener('click', () => {
    setTimeout(() => this.updateStorageInfo(), 100);
  });
};

// Toggle settings panel
window.FigtreeApp.prototype.toggleSettings = function() {
  if (!this.ui) return;
  
  const settings = this.ui.querySelector('.figtree-settings');
  const isVisible = settings.style.display !== 'none';
  
  if (isVisible) {
    this.hideSettings();
  } else {
    this.showSettings();
  }
};

// Show settings panel
window.FigtreeApp.prototype.showSettings = function() {
  if (!this.ui) return;
  
  const settings = this.ui.querySelector('.figtree-settings');
  settings.style.display = 'flex';
  this.updateStorageInfo();
};

// Hide settings panel
window.FigtreeApp.prototype.hideSettings = function() {
  if (!this.ui) return;
  
  const settings = this.ui.querySelector('.figtree-settings');
  settings.style.display = 'none';
};

// Add event listeners for pinned items
window.FigtreeApp.prototype.addPinnedItemListeners = function() {
  if (!this.ui) return;
  
  const pinnedItems = this.ui.querySelectorAll('.figtree-pinned-item');
  
  pinnedItems.forEach(item => {
    const url = item.dataset.url;
    const copyBtn = item.querySelector('.figtree-pinned-copy');
    const unpinBtn = item.querySelector('.figtree-pinned-unpin');
    
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await this.copyToClipboard(url);
      
      if (success) {
        copyBtn.textContent = '✅';
        setTimeout(() => {
          copyBtn.textContent = '📋';
        }, 2000);
      }
    });
    
    unpinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.unpinItem(url);
    });
  });
};

// Add event listeners for projects
window.FigtreeApp.prototype.addProjectListeners = function() {
  if (!this.ui) return;
  
  const projects = this.ui.querySelectorAll('.figtree-project');
  
  projects.forEach(projectEl => {
    const projectKey = projectEl.dataset.key;
    const header = projectEl.querySelector('.figtree-project-header');
    const copyBtn = projectEl.querySelector('.figtree-copy-btn');
    const pinBtn = projectEl.querySelector('.figtree-pin-btn');
    const removeBtn = projectEl.querySelector('.figtree-remove-btn');
    
    // Project expansion
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.toggleProject(projectKey);
    });
    
    // Copy project URL
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = copyBtn.dataset.url;
        const success = await this.copyToClipboard(url);
        
        if (success) {
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      });
    }
    
    // Pin/unpin project
    if (pinBtn) {
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = pinBtn.dataset.url;
        const title = projectEl.querySelector('.figtree-project-name').textContent;
        const isPinned = pinBtn.classList.contains('pinned');
        
        if (isPinned) {
          await this.unpinItem(url);
        } else {
          await this.pinItem(url, title);
        }
        
        this.updatePinButtonStates();
      });
    }
    
    // Remove project
    if (removeBtn) {
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (confirm('Remove this project from Figtree?')) {
          await this.removeProject(projectKey);
        }
      });
    }
  });
};

// Toggle project expansion
window.FigtreeApp.prototype.toggleProject = function(projectKey) {
  // This will be implemented when we add the project hierarchy display
  console.log('Toggle project:', projectKey);
};

// Filter projects based on search term
window.FigtreeApp.prototype.filterProjects = function() {
  if (!this.ui) return;
  
  const projects = this.ui.querySelectorAll('.figtree-project');
  const searchTerm = this.state.searchTerm;
  
  projects.forEach(project => {
    const name = project.querySelector('.figtree-project-name').textContent.toLowerCase();
    const matches = !searchTerm || name.includes(searchTerm);
    project.style.display = matches ? 'block' : 'none';
  });
};

// Settings actions
window.FigtreeApp.prototype.clearPinnedItems = async function() {
  if (!confirm('Clear all pinned items?')) return;
  
  this.state.pinnedItems = [];
  await this.storage.set({ pinnedItems: [] });
  this.updatePinnedItemsDisplay();
  this.updatePinButtonStates();
  this.showSuccess('Pinned items cleared');
};

window.FigtreeApp.prototype.clearProjects = async function() {
  if (!confirm('Remove all projects? This cannot be undone.')) return;
  
  this.state.projects = [];
  await this.storage.set({ figmaProjects: [] });
  this.renderProjects();
  this.showSuccess('All projects removed');
};

window.FigtreeApp.prototype.clearCache = function() {
  if (!confirm('Clear cache? Projects will need to reload.')) return;
  
  this.api.clearCache();
  this.nodeCache.clear();
  this.showSuccess('Cache cleared');
};

window.FigtreeApp.prototype.clearAllData = async function() {
  if (!confirm('⚠️ Clear ALL data including projects, pins, and settings? This cannot be undone!')) return;
  
  await this.storage.clear();
  this.api.clearCache();
  this.nodeCache.clear();
  this.state.projects = [];
  this.state.pinnedItems = [];
  
  this.renderProjects();
  this.updatePinnedItemsDisplay();
  this.showSuccess('All data cleared');
};

window.FigtreeApp.prototype.signOut = async function() {
  if (!confirm('Sign out from Figma?')) return;
  
  await this.auth.signOut();
  this.hide();
  this.showSuccess('Signed out successfully');
};

// Update storage info in settings
window.FigtreeApp.prototype.updateStorageInfo = function() {
  if (!this.ui) return;
  
  const storageInfo = this.ui.querySelector('.figtree-storage-info');
  if (!storageInfo) return;
  
  const info = this.storage.getStorageInfo();
  
  storageInfo.innerHTML = `
    <div><strong>Storage Usage:</strong> ${info.totalSizeFormatted} (${info.usagePercent}%)</div>
    <div><strong>Items:</strong> ${info.itemCount}</div>
    <div><strong>Projects:</strong> ${this.state.projects.length}</div>
    <div><strong>Pinned Items:</strong> ${this.state.pinnedItems.length}</div>
    <div style="margin-top: 8px; font-size: 11px; opacity: 0.7;">
      Data is stored locally in your browser only.
    </div>
  `;
};

  // === ui/projects.js ===
/**
 * Project rendering and hierarchy display for Figtree bookmarklet
 */

// Render a single project
window.FigtreeApp.prototype.renderProject = function(project) {
  const isPinned = this.state.pinnedItems.some(item => 
    item.url === this.api.buildNodeUrl(project.key)
  );
  
  const errorIndicator = project.error ? 
    `<span style="color: #FF3B30; font-size: 12px; margin-left: 8px;" title="${project.error}">⚠️</span>` : '';
  
  return `
    <div class="figtree-project" data-key="${project.key}">
      <div class="figtree-project-header">
        <div class="figtree-project-name">
          📁 ${project.name}${errorIndicator}
        </div>
        <div class="figtree-project-actions">
          <button class="figtree-copy-btn" data-url="${this.api.buildNodeUrl(project.key)}" title="Copy project link">📋</button>
          <button class="figtree-pin-btn ${isPinned ? 'pinned' : ''}" data-url="${this.api.buildNodeUrl(project.key)}" title="Pin project">📌</button>
          <button class="figtree-remove-btn" title="Remove project">🗑️</button>
        </div>
      </div>
      <div class="figtree-project-content" style="display: none;">
        <div class="figtree-project-loading">Loading pages...</div>
      </div>
    </div>
  `;
};

// Toggle project expansion and load pages
window.FigtreeApp.prototype.toggleProject = async function(projectKey) {
  if (!this.ui) return;
  
  const project = this.ui.querySelector(`[data-key="${projectKey}"]`);
  if (!project) return;
  
  const content = project.querySelector('.figtree-project-content');
  const isExpanded = content.style.display !== 'none';
  
  if (isExpanded) {
    content.style.display = 'none';
    return;
  }
  
  // Show content
  content.style.display = 'block';
  
  // Load pages if not already loaded
  if (content.querySelector('.figtree-project-loading')) {
    try {
      const pages = await this.api.getProjectPages(projectKey);
      content.innerHTML = this.renderPages(pages, projectKey);
      this.addPageListeners(projectKey);
    } catch (error) {
      console.error('Failed to load project pages:', error);
      content.innerHTML = `
        <div style="padding: 12px; color: #FF3B30; font-size: 13px;">
          Failed to load pages: ${error.message}
        </div>
      `;
    }
  }
};

// Render pages for a project
window.FigtreeApp.prototype.renderPages = function(pages, projectKey) {
  if (!pages || pages.length === 0) {
    return '<div style="padding: 12px; color: rgba(255,255,255,0.6); font-size: 13px;">No pages found</div>';
  }
  
  return pages.map(page => this.renderPage(page, projectKey)).join('');
};

// Render a single page
window.FigtreeApp.prototype.renderPage = function(page, projectKey) {
  const pageUrl = this.api.buildNodeUrl(projectKey, page.id);
  const isPinned = this.state.pinnedItems.some(item => item.url === pageUrl);
  
  return `
    <div class="figtree-page" data-page-id="${page.id}" style="margin-left: 16px;">
      <div class="figtree-page-header" style="padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 13px; border-radius: 4px;">
        <div class="figtree-page-name" style="color: rgba(255,255,255,0.8);">
          📄 ${page.name}
        </div>
        <div class="figtree-page-actions" style="display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s;">
          <button class="figtree-copy-btn" data-url="${pageUrl}" title="Copy page link" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px;">📋</button>
          <button class="figtree-pin-btn ${isPinned ? 'pinned' : ''}" data-url="${pageUrl}" title="Pin page" style="background: none; border: none; color: ${isPinned ? '#FFD700' : 'rgba(255,255,255,0.5)'}; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px;">📌</button>
        </div>
      </div>
      <div class="figtree-page-content" data-project-key="${projectKey}" style="display: none;">
        <div class="figtree-page-loading" style="padding: 8px 12px; color: rgba(255,255,255,0.6); font-size: 12px;">Loading frames...</div>
      </div>
    </div>
  `;
};

// Add event listeners for pages
window.FigtreeApp.prototype.addPageListeners = function(projectKey) {
  if (!this.ui) return;
  
  const pages = this.ui.querySelectorAll(`[data-project-key="${projectKey}"] .figtree-page`);
  
  pages.forEach(pageEl => {
    const pageId = pageEl.dataset.pageId;
    const header = pageEl.querySelector('.figtree-page-header');
    const copyBtn = pageEl.querySelector('.figtree-copy-btn');
    const pinBtn = pageEl.querySelector('.figtree-pin-btn');
    
    // Show actions on hover
    header.addEventListener('mouseenter', () => {
      const actions = pageEl.querySelector('.figtree-page-actions');
      if (actions) actions.style.opacity = '1';
    });
    
    header.addEventListener('mouseleave', () => {
      const actions = pageEl.querySelector('.figtree-page-actions');
      if (actions) actions.style.opacity = '0';
    });
    
    // Page expansion
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.togglePage(projectKey, pageId);
    });
    
    // Copy page URL
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = copyBtn.dataset.url;
        const success = await this.copyToClipboard(url);
        
        if (success) {
          copyBtn.textContent = '✅';
          setTimeout(() => {
            copyBtn.textContent = '📋';
          }, 2000);
        }
      });
    }
    
    // Pin/unpin page
    if (pinBtn) {
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = pinBtn.dataset.url;
        const title = pageEl.querySelector('.figtree-page-name').textContent.trim();
        const isPinned = pinBtn.classList.contains('pinned');
        
        if (isPinned) {
          await this.unpinItem(url);
          pinBtn.classList.remove('pinned');
          pinBtn.style.color = 'rgba(255,255,255,0.5)';
        } else {
          await this.pinItem(url, title);
          pinBtn.classList.add('pinned');
          pinBtn.style.color = '#FFD700';
        }
      });
    }
  });
};

// Toggle page expansion and load frames
window.FigtreeApp.prototype.togglePage = async function(projectKey, pageId) {
  if (!this.ui) return;
  
  const page = this.ui.querySelector(`[data-page-id="${pageId}"]`);
  if (!page) return;
  
  const content = page.querySelector('.figtree-page-content');
  const isExpanded = content.style.display !== 'none';
  
  if (isExpanded) {
    content.style.display = 'none';
    return;
  }
  
  // Show content
  content.style.display = 'block';
  
  // Load frames if not already loaded
  if (content.querySelector('.figtree-page-loading')) {
    try {
      const frames = await this.api.getPageFrames(projectKey, pageId);
      content.innerHTML = this.renderFrames(frames, projectKey);
      this.addFrameListeners(projectKey, pageId);
    } catch (error) {
      console.error('Failed to load page frames:', error);
      content.innerHTML = `
        <div style="padding: 8px 12px; color: #FF3B30; font-size: 12px;">
          Failed to load frames: ${error.message}
        </div>
      `;
    }
  }
};

// Render frames for a page
window.FigtreeApp.prototype.renderFrames = function(frames, projectKey) {
  if (!frames || frames.length === 0) {
    return '<div style="padding: 8px 12px; color: rgba(255,255,255,0.6); font-size: 12px;">No frames found</div>';
  }
  
  return frames.map(frame => this.renderFrame(frame, projectKey)).join('');
};

// Render a single frame
window.FigtreeApp.prototype.renderFrame = function(frame, projectKey) {
  const frameUrl = this.api.buildNodeUrl(projectKey, frame.id);
  const isPinned = this.state.pinnedItems.some(item => item.url === frameUrl);
  
  return `
    <div class="figtree-frame" data-frame-id="${frame.id}" style="margin-left: 16px; margin-bottom: 4px;">
      <div class="figtree-frame-header" style="padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 13px; border-radius: 4px; background: rgba(255,255,255,0.02);">
        <div class="figtree-frame-name" style="color: rgba(255,255,255,0.8);">
          🖼️ ${frame.name}
        </div>
        <div class="figtree-frame-actions" style="display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s;">
          <button class="figtree-copy-btn" data-url="${frameUrl}" title="Copy frame link" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px;">📋</button>
          <button class="figtree-pin-btn ${isPinned ? 'pinned' : ''}" data-url="${frameUrl}" title="Pin frame" style="background: none; border: none; color: ${isPinned ? '#FFD700' : 'rgba(255,255,255,0.5)'}; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px;">📌</button>
        </div>
      </div>
      <div class="figtree-frame-content" data-project-key="${projectKey}" style="display: none;">
        <div class="figtree-frame-preview" style="margin: 8px 12px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.05); min-height: 80px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5); font-size: 12px;">
          Loading preview...
        </div>
        <div class="figtree-frame-groups"></div>
      </div>
    </div>
  `;
};

// Add event listeners for frames
window.FigtreeApp.prototype.addFrameListeners = function(projectKey, pageId) {
  if (!this.ui) return;
  
  const frames = this.ui.querySelectorAll(`[data-project-key="${projectKey}"] .figtree-frame`);
  
  frames.forEach(frameEl => {
    const frameId = frameEl.dataset.frameId;
    const header = frameEl.querySelector('.figtree-frame-header');
    const copyBtn = frameEl.querySelector('.figtree-copy-btn');
    const pinBtn = frameEl.querySelector('.figtree-pin-btn');
    
    // Show actions on hover
    header.addEventListener('mouseenter', () => {
      const actions = frameEl.querySelector('.figtree-frame-actions');
      if (actions) actions.style.opacity = '1';
    });
    
    header.addEventListener('mouseleave', () => {
      const actions = frameEl.querySelector('.figtree-frame-actions');
      if (actions) actions.style.opacity = '0';
    });
    
    // Frame expansion
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.toggleFrame(projectKey, frameId);
    });
    
    // Copy frame URL
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = copyBtn.dataset.url;
        const success = await this.copyToClipboard(url);
        
        if (success) {
          copyBtn.textContent = '✅';
          setTimeout(() => {
            copyBtn.textContent = '📋';
          }, 2000);
        }
      });
    }
    
    // Pin/unpin frame
    if (pinBtn) {
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = pinBtn.dataset.url;
        const title = frameEl.querySelector('.figtree-frame-name').textContent.trim();
        const isPinned = pinBtn.classList.contains('pinned');
        
        if (isPinned) {
          await this.unpinItem(url);
          pinBtn.classList.remove('pinned');
          pinBtn.style.color = 'rgba(255,255,255,0.5)';
        } else {
          // Try to get frame preview for pinned item
          const preview = frameEl.querySelector('.figtree-frame-preview img');
          const previewUrl = preview ? preview.src : null;
          
          await this.pinItem(url, title, previewUrl);
          pinBtn.classList.add('pinned');
          pinBtn.style.color = '#FFD700';
        }
      });
    }
  });
};

// Toggle frame expansion and load preview/groups
window.FigtreeApp.prototype.toggleFrame = async function(projectKey, frameId) {
  if (!this.ui) return;
  
  const frame = this.ui.querySelector(`[data-frame-id="${frameId}"]`);
  if (!frame) return;
  
  const content = frame.querySelector('.figtree-frame-content');
  const isExpanded = content.style.display !== 'none';
  
  if (isExpanded) {
    content.style.display = 'none';
    return;
  }
  
  // Show content
  content.style.display = 'block';
  
  const preview = content.querySelector('.figtree-frame-preview');
  const groupsContainer = content.querySelector('.figtree-frame-groups');
  
  // Load preview and groups if not already loaded
  if (preview.textContent === 'Loading preview...') {
    try {
      // Load frame preview
      const images = await this.api.getImages(projectKey, [frameId], { 
        format: 'png', 
        scale: '1' 
      });
      
      const imageUrl = images.images[frameId];
      if (imageUrl) {
        preview.innerHTML = `<img src="${imageUrl}" alt="Frame preview" style="width: 100%; height: auto; display: block; border-radius: 4px;">`;
      } else {
        preview.innerHTML = '<div style="color: rgba(255,255,255,0.4);">Preview not available</div>';
      }
      
      // Load groups
      const groups = await this.api.getFrameGroups(projectKey, frameId);
      if (groups && groups.length > 0) {
        groupsContainer.innerHTML = groups.map(group => this.renderGroup(group, projectKey)).join('');
        this.addGroupListeners(projectKey, frameId);
      }
      
    } catch (error) {
      console.error('Failed to load frame content:', error);
      preview.innerHTML = '<div style="color: #FF3B30;">Failed to load preview</div>';
    }
  }
};

// Render a group
window.FigtreeApp.prototype.renderGroup = function(group, projectKey) {
  const groupUrl = this.api.buildNodeUrl(projectKey, group.id);
  const isPinned = this.state.pinnedItems.some(item => item.url === groupUrl);
  
  return `
    <div class="figtree-group" data-group-id="${group.id}" style="margin-left: 16px; margin-bottom: 2px;">
      <div class="figtree-group-header" style="padding: 4px 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12px; border-radius: 3px; background: rgba(255,255,255,0.02);">
        <div class="figtree-group-name" style="color: rgba(255,255,255,0.7);">
          📦 ${group.name}
        </div>
        <div class="figtree-group-actions" style="display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s;">
          <button class="figtree-copy-btn" data-url="${groupUrl}" title="Copy group link" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 10px; padding: 2px; border-radius: 2px;">📋</button>
          <button class="figtree-pin-btn ${isPinned ? 'pinned' : ''}" data-url="${groupUrl}" title="Pin group" style="background: none; border: none; color: ${isPinned ? '#FFD700' : 'rgba(255,255,255,0.5)'}; cursor: pointer; font-size: 10px; padding: 2px; border-radius: 2px;">📌</button>
        </div>
      </div>
    </div>
  `;
};

// Add event listeners for groups
window.FigtreeApp.prototype.addGroupListeners = function(projectKey, frameId) {
  if (!this.ui) return;
  
  const groups = this.ui.querySelectorAll(`[data-project-key="${projectKey}"] .figtree-group`);
  
  groups.forEach(groupEl => {
    const header = groupEl.querySelector('.figtree-group-header');
    const copyBtn = groupEl.querySelector('.figtree-copy-btn');
    const pinBtn = groupEl.querySelector('.figtree-pin-btn');
    
    // Show actions on hover
    header.addEventListener('mouseenter', () => {
      const actions = groupEl.querySelector('.figtree-group-actions');
      if (actions) actions.style.opacity = '1';
    });
    
    header.addEventListener('mouseleave', () => {
      const actions = groupEl.querySelector('.figtree-group-actions');
      if (actions) actions.style.opacity = '0';
    });
    
    // Copy group URL
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = copyBtn.dataset.url;
        const success = await this.copyToClipboard(url);
        
        if (success) {
          copyBtn.textContent = '✅';
          setTimeout(() => {
            copyBtn.textContent = '📋';
          }, 2000);
        }
      });
    }
    
    // Pin/unpin group
    if (pinBtn) {
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = pinBtn.dataset.url;
        const title = groupEl.querySelector('.figtree-group-name').textContent.trim();
        const isPinned = pinBtn.classList.contains('pinned');
        
        if (isPinned) {
          await this.unpinItem(url);
          pinBtn.classList.remove('pinned');
          pinBtn.style.color = 'rgba(255,255,255,0.5)';
        } else {
          await this.pinItem(url, title);
          pinBtn.classList.add('pinned');
          pinBtn.style.color = '#FFD700';
        }
      });
    }
  });
};

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Figtree] Bookmarklet loaded');
    });
  } else {
    console.log('[Figtree] Bookmarklet loaded');
  }
  
})();
