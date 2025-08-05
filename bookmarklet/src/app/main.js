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