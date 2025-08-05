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