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