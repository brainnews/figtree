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