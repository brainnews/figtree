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