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