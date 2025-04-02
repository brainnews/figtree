// Global variables
if (typeof accessToken === 'undefined') var accessToken = null;
if (typeof nodeCache === 'undefined') var nodeCache = new Map();
if (typeof panelState === 'undefined') var panelState = {
  isOpen: false,
  container: null
};

// Figma API configuration
if (typeof FIGMA_API_BASE === 'undefined') var FIGMA_API_BASE = 'https://api.figma.com/v1';

// Function to update pinned items display
function updatePinnedItemsDisplay(container) {
  const pinnedItemsContent = container.querySelector('.figtree-pinned-items-content');
  if (!pinnedItemsContent) return;

  // Get current settings and pinned items
  chrome.storage.sync.get(['pinnedItemsSettings', 'pinnedItems'], (result) => {
    const settings = result.pinnedItemsSettings || {
      maxPinnedItems: 5
    };

    const pinnedItems = result.pinnedItems || [];
    
    // Clear existing content
    pinnedItemsContent.innerHTML = '';

    if (pinnedItems.length === 0) {
      pinnedItemsContent.innerHTML = '<div class="figtree-empty">No pinned items</div>';
      return;
    }

    // Add each pinned item
    pinnedItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'figtree-pinned-item';
      itemElement.innerHTML = `
        <div class="figtree-pinned-item-info">
          ${item.preview ? `
            <div class="figtree-pinned-item-preview">
              <img src="${item.preview}" alt="${item.title}" onerror="this.style.display='none'">
            </div>
          ` : ''}
          <span class="figtree-pinned-item-title">${item.title}</span>
        </div>
        <div class="figtree-pinned-item-actions">
          <button class="figtree-pinned-item-copy" title="Copy link">
          </button>
          <button class="figtree-pinned-item-unpin" title="Unpin item">
          </button>
        </div>
      `;

      // Add copy handler
      const copyButton = itemElement.querySelector('.figtree-pinned-item-copy');
      copyButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        await copyToClipboard(item.url);
        itemElement.classList.add('copied');
        setTimeout(() => {
          itemElement.classList.remove('copied');
        }, 2000);
      });

      // Add unpin handler
      const unpinButton = itemElement.querySelector('.figtree-pinned-item-unpin');
      unpinButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const updatedItems = pinnedItems.filter(i => i.url !== item.url);
        await chrome.storage.sync.set({ pinnedItems: updatedItems });
        
        // Update pinned items display
        updatePinnedItemsDisplay(container);
        
        // Update pin button states in the main tree
        const pinButtons = container.querySelectorAll('.figtree-pin-button');
        pinButtons.forEach(button => {
          const buttonUrl = button.closest('.figtree-project-header, .figtree-page-header, .figtree-frame-header, .figtree-group-header')
            ?.querySelector('.figtree-copy-btn')?.dataset.url;
          if (buttonUrl === item.url) {
            button.classList.remove('pinned');
          }
        });
      });

      pinnedItemsContent.appendChild(itemElement);
    });
  });
}

// Function to pin an item
async function pinItem(url, title, preview = null) {
  const { pinnedItems = [] } = await chrome.storage.sync.get(['pinnedItems']);
  
  // Check if item is already pinned
  if (pinnedItems.some(item => item.url === url)) {
    return;
  }
  
  // Add new item
  pinnedItems.push({
    url,
    title,
    preview,
    pinnedAt: Date.now()
  });
  
  await chrome.storage.sync.set({ pinnedItems });
  if (panelState.container) {
    updatePinnedItemsDisplay(panelState.container);
  }
}

// Function to unpin an item
async function unpinItem(url) {
  const { pinnedItems = [] } = await chrome.storage.sync.get('pinnedItems');
  const updatedItems = pinnedItems.filter(item => item.url !== url);
  await chrome.storage.sync.set({ pinnedItems: updatedItems });
  
  // Update all pin buttons in the UI
  if (panelState.container) {
    // Update pinned items display
    updatePinnedItemsDisplay(panelState.container);
    
    // Update pin button states in the main tree
    const pinButtons = panelState.container.querySelectorAll('.figtree-pin-button');
    pinButtons.forEach(button => {
      const buttonUrl = button.closest('.figtree-project-header, .figtree-page-header, .figtree-frame-header, .figtree-group-header')
        ?.querySelector('.figtree-copy-btn')?.dataset.url;
      if (buttonUrl === url) {
        button.classList.remove('pinned');
      }
    });
  }
}

// Create and inject the Figtree UI
function createFigtreeUI() {
  // Remove any existing panel first
  if (panelState.container) {
    panelState.container.remove();
    panelState.isOpen = false;
  }
  
  const container = document.createElement('div');
  container.className = 'figtree-container';

  // Add dragging functionality
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  const dragStart = (e) => {
    // Only allow dragging from the header or container itself (not its children)
    if (e.target.closest('.figtree-add-project, .figtree-search, .figtree-projects')) {
      return;
    }

    if (e.type === "touchstart") {
      initialX = e.touches[0].clientX - xOffset;
      initialY = e.touches[0].clientY - yOffset;
    } else {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
    }

    isDragging = true;
    container.style.cursor = 'grabbing';
  };

  const dragEnd = () => {
    if (!isDragging) return;
    
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    container.style.cursor = 'move';
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

    // Get container bounds
    const containerRect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate bounds to keep at least 20px visible
    const minX = -(viewportWidth + containerRect.width);
    const maxX = viewportWidth - containerRect.width + 20;
    const minY = 0;
    const maxY = viewportHeight - 20;

    // Apply bounds
    xOffset = Math.min(Math.max(currentX, minX), maxX);
    yOffset = Math.min(Math.max(currentY, minY), maxY);

    container.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  };

  // Clean up event listeners when panel is closed
  const cleanup = () => {
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", drag);
    document.removeEventListener("touchend", dragEnd);
  };

  // Add cleanup to the close button click handler
  const closePanel = () => {
    cleanup();
    container.remove();
    panelState.isOpen = false;
    panelState.container = null;
  };

  // Create the HTML structure first
  container.innerHTML = `
    <div class="figtree-header">
      <img src="https://files.getfigtree.com/figtree-icon-transparent.png" alt="Figtree Logo" class="figtree-logo">
      <span class="figtree-title">Figtree</span>
      <div class="figtree-header-buttons">
        <button class="figtree-settings" title="Settings">
          <span class="material-symbols-outlined">settings</span>
        </button>
        <button class="figtree-minimize">
          <span class="material-symbols-outlined">expand_more</span>
        </button>
        <button class="figtree-close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
    <div class="figtree-add-project">
      <input type="text" class="figtree-url-input" placeholder="Add Figma file by URL">
      <button class="figtree-add-button">
        <span class="material-symbols-outlined">add</span>
      </button>
    </div>
    <div class="figtree-search">
      <input type="text" class="figtree-search-input" placeholder="Search projects...">
      <button class="figtree-search-clear" style="display: none;">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="figtree-pinned-items">
      <div class="figtree-pinned-items-header">
        <span>Pinned</span>
        <button class="figtree-pinned-items-toggle">
          <span class="material-symbols-outlined">expand_less</span>
        </button>
      </div>
      <div class="figtree-pinned-items-content"></div>
    </div>
    <div class="figtree-projects"></div>
    <div class="figtree-settings-panel">
      <div class="figtree-settings-header">
        <h2>Settings</h2>
        <button class="figtree-settings-close">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="figtree-settings-content">
        <div class="figtree-settings-section">
          <div class="figtree-settings-group">
            <button class="figtree-settings-button" data-action="clearPinned">
              Clear All Pinned Items
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add styles for pinned items panel
  const pinnedItemsStyles = document.createElement('style');
  pinnedItemsStyles.textContent = `
    .figtree-pinned-items-header {
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      font-weight: 500;
    }

    .figtree-pinned-items-header:hover {
      background-color: #3d3d3d;
    }

    .figtree-pinned-items-toggle {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: transform 0.2s ease;
    }

    .figtree-pinned-items-toggle:hover {
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.1);
    }

    .figtree-pinned-items.collapsed .figtree-pinned-items-toggle {
      transform: rotate(180deg);
    }

    .figtree-pinned-items.collapsed .figtree-pinned-items-content {
      display: none;
    }

    .figtree-pinned-items-content {
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background-color:rgba(26, 29, 27);
      transition: max-height 0.3s ease;
    }
  `;
  document.head.appendChild(pinnedItemsStyles);

  // Load saved pinned items panel state
  chrome.storage.sync.get(['pinnedItemsPanelCollapsed'], (result) => {
    const pinnedItemsPanel = container.querySelector('.figtree-pinned-items');
    if (result.pinnedItemsPanelCollapsed) {
      pinnedItemsPanel.classList.add('collapsed');
    }
  });

  // Add toggle handler for pinned items panel
  const pinnedItemsHeader = container.querySelector('.figtree-pinned-items-header');
  const pinnedItemsPanel = container.querySelector('.figtree-pinned-items');
  
  pinnedItemsHeader.addEventListener('click', () => {
    pinnedItemsPanel.classList.toggle('collapsed');
    // Save the state
    chrome.storage.sync.set({
      pinnedItemsPanelCollapsed: pinnedItemsPanel.classList.contains('collapsed')
    });
  });

  // Add event listeners for both mouse and touch events
  container.addEventListener("mousedown", dragStart, { passive: false });
  document.addEventListener("mousemove", drag, { passive: false });
  document.addEventListener("mouseup", dragEnd, { passive: false });
  container.addEventListener("touchstart", dragStart, { passive: false });
  document.addEventListener("touchmove", drag, { passive: false });
  document.addEventListener("touchend", dragEnd, { passive: false });

  // Now add event listeners after the HTML is created
  const minimizeButton = container.querySelector('.figtree-minimize');
  if (minimizeButton) {
    minimizeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('minimized');
    });
  }

  // Settings panel functionality
  const settingsButton = container.querySelector('.figtree-settings');
  const settingsPanel = container.querySelector('.figtree-settings-panel');
  const settingsCloseButton = container.querySelector('.figtree-settings-close');

  if (settingsButton && settingsPanel && settingsCloseButton) {
    // Settings panel toggle
    settingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // If panel is minimized, expand it first
      if (container.classList.contains('minimized')) {
        container.classList.remove('minimized');
      }
      settingsPanel.classList.toggle('open');
    });

    settingsCloseButton.addEventListener('click', () => {
      settingsPanel.classList.remove('open');
    });

    // Handle clear all pinned items
    const clearPinnedButton = container.querySelector('[data-action="clearPinned"]');
    if (clearPinnedButton) {
      clearPinnedButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all pinned items?')) {
          chrome.storage.sync.remove(['pinnedItems'], () => {
            updatePinnedItemsDisplay(container);
          });
        }
      });
    }
  }

  // Update the copy button handlers to include pin functionality
  function updateCopyButtonHandlers() {
    const copyButtons = container.querySelectorAll('.figtree-copy-btn');
    copyButtons.forEach(button => {
      const url = button.dataset.url;
      if (!url) return;

      // Get the title from the parent element
      const titleElement = button.closest('.figtree-project-header, .figtree-page-header, .figtree-frame-header, .figtree-group-header')
        ?.querySelector('.figtree-project-name, .figtree-page-name, .figtree-frame-name, .figtree-group-name');
      const title = titleElement ? titleElement.textContent.trim() : url;

      // Get preview if available
      const previewElement = button.closest('.figtree-frame')?.querySelector('.figtree-frame-preview img');
      const preview = previewElement ? previewElement.src : null;

      // Add pin button only if one doesn't already exist
      const existingPinButton = button.parentNode.querySelector('.figtree-pin-button');
      if (!existingPinButton) {
        const pinButton = document.createElement('button');
        pinButton.className = 'figtree-pin-button';
        pinButton.title = 'Pin item';
        pinButton.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
        
        // Check if item is pinned
        chrome.storage.sync.get(['pinnedItems'], (result) => {
          const pinnedItems = result.pinnedItems || [];
          if (pinnedItems.some(item => item.url === url)) {
            pinButton.classList.add('pinned');
          }
        });

        // Add pin/unpin handler
        pinButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          const isPinned = pinButton.classList.contains('pinned');
          if (isPinned) {
            await unpinItem(url);
            pinButton.classList.remove('pinned');
          } else {
            await pinItem(url, title, preview);
            pinButton.classList.add('pinned');
          }
        });

        // Insert pin button before copy button
        button.parentNode.insertBefore(pinButton, button);
      }

      // Add copy handler
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        await copyToClipboard(url);
        button.classList.add('copied');
        setTimeout(() => {
          button.classList.remove('copied');
        }, 2000);
      });
    });
  }

  // Call updateCopyButtonHandlers after creating project items
  const originalCreateProjectItem = createProjectItem;
  createProjectItem = function(project) {
    const element = originalCreateProjectItem(project);
    updateCopyButtonHandlers();
    return element;
  };

  // Initial display update
  updatePinnedItemsDisplay(container);

  // Update display when settings change
  const settingsInputs = container.querySelectorAll('.figtree-settings-select');
  settingsInputs.forEach(input => {
    input.addEventListener('change', () => {
      updatePinnedItemsDisplay(container);
    });
  });

  // Update close button click handler to use the cleanup function
  const closeButton = container.querySelector('.figtree-close');
  if (closeButton) {
    closeButton.addEventListener('click', closePanel);
  }
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
    .material-symbols-outlined {
      font-variation-settings:
      'FILL' 0,
      'wght' 400,
      'GRAD' 0,
      'opsz' 24
    }
    .figtree-container {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 80vh;
      background: #2c2c2c;
      backdrop-filter: blur(24px);
      border-radius: 16px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      cursor: move;
      user-select: none;
      transform: translate(0, 0);
      transition: max-height 0.3s ease;
      overflow: hidden;
      border: 1px solid #3d3d3d;
    }
    
    .figtree-container.minimized {
      max-height: 58px;
      overflow: hidden;
    }
    
    .figtree-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: move;
    }

    .figtree-header-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .figtree-minimize,
    .figtree-close {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .figtree-settings {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .figtree-settings:hover {
      opacity: 1;
    }

    .figtree-minimize:hover,
    .figtree-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }

    .figtree-minimize .material-symbols-outlined {
      font-size: 18px;
      transition: transform 0.3s ease;
    }

    .figtree-container.minimized .figtree-minimize .material-symbols-outlined {
      transform: rotate(180deg);
    }

    .figtree-logo {
      width: 24px;
    }
    
    .figtree-title {
      margin-left: 8px;
      font-size: 14px;
      font-weight: 500;
      flex-grow: 1;
    }

    .figtree-projects-empty-image {
      width: 50px;
      margin-bottom: 20px;
    }
    
    .figtree-empty {
      text-align: center;
      font-size: 14px;
      line-height: 18px;
      padding: 20px;
    }

    .figtree-add-project {
      padding: 12px 16px;
      display: flex;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .figtree-add-project,
    .figtree-search,
    .figtree-projects {
      cursor: default;
    }
    
    .figtree-url-input {
      flex-grow: 1;
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 6px 0px;
      color: #fff;
      font-size: 13px;
      outline: none;
    }
    
    .figtree-url-input:focus {
      border-color: #0D99FF;
    }
    
    .figtree-url-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    
    .figtree-add-button {
      background: #0D99FF;
      border: none;
      border-radius: 4px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #fff;
      padding: 0;
    }
    
    .figtree-add-button:hover {
      background: #0B87E0;
    }
    
    .figtree-add-button .material-symbols-outlined, .figtree-add-button .material-symbols-outlined {
      font-size: 20px;
    }
    
    .figtree-search {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .figtree-search-input {
      width: 100%;
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 6px 0px;
      color: #fff;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    }
    
    .figtree-search-input:focus {
      border-color: #0D99FF;
    }
    
    .figtree-search-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    
    .figtree-projects {
      overflow-y: auto;
      padding: 8px 0;
      border-top: 1px solid #3d3d3d;
    }
    
    .figtree-project,
    .figtree-page,
    .figtree-frame,
    .figtree-group {
      margin: 0;
      width: 100%;
    }
    
    .figtree-project-header,
    .figtree-page-header,
    .figtree-frame-header,
    .figtree-group-header {
      padding: 6px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
    }
    
    .figtree-project-header:hover,
    .figtree-page-header:hover,
    .figtree-frame-header:hover,
    .figtree-group:hover {
      background: #3d3d3d;
    }
    
    .figtree-project-name,
    .figtree-page-name,
    .figtree-frame-name,
    .figtree-group-name {
      color: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .figtree-project-name::before,
    .figtree-frame-name::before,
    .figtree-group-name::before {
      font-family: 'Material Symbols Outlined';
      font-size: 16px;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
    }

    .figtree-page-name::before {
      content: '';
      width: 0px;
    }
    
    .figtree-project-name::before {
      content: 'folder';
    }
    
    .figtree-frame-name::before {
      content: 'grid_3x3';
    }
    
    .figtree-group-name::before {
      content: 'select';
    }
    
    .figtree-project-content,
    .figtree-page-content,
    .figtree-frame-content {
      display: none;
      padding-left: 16px;
      width: 100%;
      box-sizing: border-box;
    }
    
    .figtree-project-content.expanded,
    .figtree-page-content.expanded,
    .figtree-frame-content.expanded {
      display: block;
    }
    
    .figtree-copy-btn {
      opacity: 0;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 4px 6px;
      cursor: pointer;
      font-size: 12px;
      transition: opacity 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: center;
      border-radius: 4px;
    }
    
    .figtree-copy-btn::before {
      content: 'link';
      font-family: 'Material Symbols Outlined';
      font-size: 14px;
    }
    
    .figtree-project-header:hover .figtree-copy-btn,
    .figtree-page-header:hover .figtree-copy-btn,
    .figtree-frame-header:hover .figtree-copy-btn,
    .figtree-group:hover .figtree-copy-btn {
      opacity: 1;
    }
    
    .figtree-copy-btn:hover {
      color:rgb(13, 255, 126);
      background: rgba(13, 153, 255, 0.1);
    }
    
    .figtree-copy-btn.copied {
      color:rgb(13, 255, 126);
    }
    
    .figtree-copy-btn.copied::before {
      content: 'check';
    }
    
    .figtree-error {
      padding: 8px 16px;
      color: #ff6b6b;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .figtree-error::before {
      content: 'error';
      font-family: 'Material Icons';
      font-size: 14px;
    }
    
    .figtree-loading {
      padding: 8px 16px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .figtree-loading::before {
      content: 'refresh';
      font-family: 'Material Icons';
      font-size: 14px;
      display: inline-block;
      animation: figtree-spin 0.6s linear infinite;
    }
    
    @keyframes figtree-spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    .figtree-loading-item {
      padding: 6px 16px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      animation: figtree-pulse 1.5s ease-in-out infinite;
    }
    
    .figtree-loading-header {
      height: 20px;
      display: flex;
      align-items: center;
    }
    
    .figtree-loading-text {
      color: rgba(255, 255, 255, 0.3);
      font-size: 13px;
    }
    
    @keyframes figtree-pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
      100% {
        opacity: 1;
      }
    }
    
    .figtree-project.hidden,
    .figtree-page.hidden,
    .figtree-frame.hidden,
    .figtree-group.hidden {
      display: none;
    }

    .figtree-settings-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: 300px;
      height: 100%;
      background: #2c2c2c;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 1000000;
      display: flex;
      flex-direction: column;
    }

    .figtree-settings-panel.open {
      transform: translateX(0);
    }

    .figtree-settings-header {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .figtree-settings-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    .figtree-settings-close {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .figtree-settings-content {
      padding: 16px;
      overflow-y: auto;
    }

    .figtree-settings-section {
      margin-bottom: 24px;
    }

    .figtree-settings-section h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
    }

    .figtree-settings-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .figtree-settings-group label {
      display: flex;
      flex-direction: row;
      gap: 8px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      align-items: center;
      justify-content: space-between;
    }

    .figtree-settings-select {
      background: #3c3c3c;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      width: fit-content;
    }

    .figtree-settings-button {
      background: #3c3c3c;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .figtree-settings-button:hover {
      background: #4c4c4c;
    }

    .figtree-settings-button[data-action="clearPinned"] {
      background: #dc3545;
      border-color: #dc3545;
    }

    .figtree-settings-button[data-action="clearPinned"]:hover {
      background: #c82333;
    }

    .figtree-search-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
    .figtree-search::before {
      content: 'search';
      font-family: 'Material Symbols Outlined';
      font-size: 14px;
    }

    .figtree-pinned-items-content {
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .figtree-pinned-item {
      padding: 6px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .figtree-pinned-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .figtree-pinned-item-info {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .figtree-pinned-item-preview {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
      overflow: hidden;
    }

    .figtree-pinned-item-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .figtree-pinned-item-title {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-grow: 1;
    }

    .figtree-pinned-item-actions {
      display: flex;
      gap: 4px;
      align-items: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .figtree-pinned-item:hover .figtree-pinned-item-actions {
      opacity: 1;
    }

    .figtree-pinned-item-copy,
    .figtree-pinned-item-unpin {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 4px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .figtree-pinned-item-copy::before {
      content: 'link';
      font-family: 'Material Symbols Outlined';
      font-size: 14px;
    }
    .figtree-pinned-item-unpin::before {
      content: 'close';
      font-family: 'Material Symbols Outlined';
      font-size: 14px;
    }
    .figtree-pinned-item-copy:hover {
      color: rgb(13, 255, 126);
      background: rgba(13, 153, 255, 0.1);
    }

    .figtree-pinned-item-unpin:hover {
      color: #FF3B30;
      background: rgba(255, 59, 48, 0.1);
    }

    .figtree-pinned-item.copied .figtree-pinned-item-copy {
      color:rgb(13, 255, 126);
    }

    .figtree-pinned-item.copied .figtree-pinned-item-copy::before {
      content: 'check';
    }

    .figtree-pin-button {
      opacity: 0;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 4px 6px;
      cursor: pointer;
      transition: opacity 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .figtree-pin-button:hover {
      color: #FFD700;
      background: rgba(255, 215, 0, 0.1);
    }

    .figtree-pin-button.pinned {
      color: #FFD700;
      opacity: 1;
    }

    .figtree-pin-button .material-symbols-outlined {
      font-size: 16px;
    }

    .figtree-project-header:hover .figtree-pin-button,
    .figtree-page-header:hover .figtree-pin-button,
    .figtree-frame-header:hover .figtree-pin-button,
    .figtree-group-header:hover .figtree-pin-button {
      opacity: 1;
    }
    .figtree-project-actions, .figtree-page-actions, .figtree-frame-actions, .figtree-group-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .figtree-search-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .figtree-search-clear {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .figtree-search-clear:hover {
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.1);
    }

    .figtree-search-clear .material-symbols-outlined {
      font-size: 16px;
    }

    .figtree-search::before {
      content: 'search';
      font-family: 'Material Symbols Outlined';
      font-size: 14px;
    }

    .figtree-add-button.loading .material-symbols-outlined {
      animation: figtree-spin 0.6s linear infinite;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(container);
  
  panelState.container = container;
  panelState.isOpen = true;
  
  // Handle URL input
  const urlInput = container.querySelector('.figtree-url-input');
  const addButton = container.querySelector('.figtree-add-button');
  
  const addProject = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    
    // Parse file key from URL
    const fileKey = parseFileKey(url);
    if (!fileKey) {
      showError('Invalid Figma URL');
      return;
    }
    
    // Get stored projects
    const { figmaProjects = [] } = await chrome.storage.local.get('figmaProjects');
    
    // Check if project already exists
    if (figmaProjects.some(p => p.key === fileKey)) {
      showError('Project already added');
      return;
    }
    
    // Add loading state
    addButton.disabled = true;
    urlInput.disabled = true;
    addButton.innerHTML = '<span class="material-symbols-outlined">refresh</span>';
    addButton.classList.add('loading');
    
    try {
      // Verify the file exists and get its data
      const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        throw new Error('Could not access file');
      }
      
      const fileData = await response.json();
      
      // Add to stored projects
      const updatedProjects = [...figmaProjects, { key: fileKey, name: fileData.name }];
      await chrome.storage.local.set({ figmaProjects: updatedProjects });
      
      // Clear input
      urlInput.value = '';
      
      // Show loading state in projects list
      const projectsContainer = container.querySelector('.figtree-projects');
      projectsContainer.innerHTML = '';
      projectsContainer.appendChild(createLoadingItem('Loading projects...'));
      
      // Refresh projects list
      chrome.runtime.sendMessage({ action: 'refreshProjects' });
      
    } catch (error) {
      showError(error.message);
    } finally {
      addButton.disabled = false;
      urlInput.disabled = false;
      addButton.innerHTML = '<span class="material-symbols-outlined">add</span>';
      addButton.classList.remove('loading');
    }
  };
  
  addButton.addEventListener('click', addProject);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addProject();
    }
  });
  
  // Add search functionality
  const searchInput = container.querySelector('.figtree-search-input');
  const searchClearButton = container.querySelector('.figtree-search-clear');
  let isPreFetching = false;

  // Show/hide clear button based on input value
  searchInput.addEventListener('input', (e) => {
    searchClearButton.style.display = e.target.value ? 'flex' : 'none';
  });

  // Clear search input when clear button is clicked
  searchClearButton.addEventListener('click', () => {
    searchInput.value = '';
    searchClearButton.style.display = 'none';
    // Trigger the search input event to reset the view
    searchInput.dispatchEvent(new Event('input'));
  });

  // Pre-fetch all data when search is focused
  searchInput.addEventListener('focus', async () => {
    if (isPreFetching) return;
    isPreFetching = true;

    const projects = container.querySelectorAll('.figtree-project');
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'figtree-loading';
    loadingIndicator.textContent = 'Indexing projects...';
    container.querySelector('.figtree-projects').prepend(loadingIndicator);

    try {
      await Promise.all(Array.from(projects).map(async project => {
        const projectKey = project.querySelector('.figtree-remove-btn').dataset.key;
        
        // Fetch project data if not cached
        if (!nodeCache.has(projectKey)) {
          const fileResponse = await fetch(`${FIGMA_API_BASE}/files/${projectKey}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (!fileResponse.ok) return;
          
          const fileData = await fileResponse.json();
          nodeCache.set(projectKey, fileData);
        }
      }));
    } catch (error) {
      console.error('Error pre-fetching data:', error);
    } finally {
      loadingIndicator.remove();
      isPreFetching = false;
    }
  });

  searchInput.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const projects = container.querySelectorAll('.figtree-project');
    
    // If search term is less than 3 characters, show all projects in collapsed state
    if (searchTerm.length < 3) {
      projects.forEach(project => {
        project.classList.remove('hidden');
        const projectContent = project.querySelector('.figtree-project-content');
        projectContent.classList.remove('expanded');
        
        // Hide all pages
        const pages = project.querySelectorAll('.figtree-page');
        pages.forEach(page => {
          page.classList.remove('hidden');
          const pageContent = page.querySelector('.figtree-page-content');
          pageContent.classList.remove('expanded');
          
          // Hide all frames
          const frames = page.querySelectorAll('.figtree-frame');
          frames.forEach(frame => {
            frame.classList.remove('hidden');
            const frameContent = frame.querySelector('.figtree-frame-content');
            frameContent.classList.remove('expanded');
          });
        });
      });
      return;
    }
    
    for (const project of projects) {
      const projectKey = project.querySelector('.figtree-remove-btn').dataset.key;
      const projectData = nodeCache.get(projectKey);
      const projectName = project.querySelector('.figtree-project-name').textContent.toLowerCase();
      let hasVisibleContent = projectName.includes(searchTerm);
      
      // If we have pre-fetched data, use it for more accurate search
      if (projectData) {
        const projectContent = project.querySelector('.figtree-project-content');
        const pagesContainer = projectContent.querySelector('.figtree-pages');
        
        // Ensure pages are loaded if we have matches
        if (!pagesContainer.children.length && (hasVisibleContent || searchTerm)) {
          projectContent.classList.add('expanded');
          await fetchProjectPages(projectKey, pagesContainer);
        }

        for (const page of projectData.document.children) {
          const pageName = page.name.toLowerCase();
          const pageVisible = pageName.includes(searchTerm);
          const pageElement = project.querySelector(`[data-page-id="${page.id}"]`);
          let pageHasVisibleContent = pageVisible;
          
          if (pageElement) {
            const pageContent = pageElement.querySelector('.figtree-page-content');
            const framesContainer = pageContent.querySelector('.figtree-frames');
            
            // Load frames if we need to search them
            if (!framesContainer.children.length && searchTerm) {
              pageContent.classList.add('expanded');
              await fetchPageFrames(projectKey, page.id, framesContainer);
            }

            if (page.children) {
              for (const frame of page.children) {
                if (frame.type === 'FRAME') {
                  const frameName = frame.name.toLowerCase();
                  const frameVisible = frameName.includes(searchTerm);
                  const frameElement = pageElement.querySelector(`[data-frame-id="${frame.id}"]`);
                  let frameHasVisibleContent = frameVisible;
                  
                  if (frameElement) {
                    const frameContent = frameElement.querySelector('.figtree-frame-content');
                    
                    if (frame.children) {
                      frame.children.forEach(group => {
                        if (group.type === 'GROUP') {
                          const groupName = group.name.toLowerCase();
                          const groupVisible = groupName.includes(searchTerm);
                          const groupElement = frameElement.querySelector(`[data-group-id="${group.id}"]`);
                          
                          if (groupElement) {
                            groupElement.classList.toggle('hidden', !groupVisible);
                            if (groupVisible) {
                              frameHasVisibleContent = true;
                              frameContent.classList.add('expanded');
                              pageContent.classList.add('expanded');
                              projectContent.classList.add('expanded');
                              
                              // Load frame preview if not already loaded
                              const preview = frameContent.querySelector('.figtree-frame-preview');
                              if (preview && preview.querySelector('.figtree-frame-preview-loading')) {
                                loadFramePreview(projectKey, frame, preview);
                              }
                            }
                          }
                        }
                      });
                    }
                    
                    frameElement.classList.toggle('hidden', !frameHasVisibleContent);
                    if (frameHasVisibleContent) {
                      pageHasVisibleContent = true;
                      frameContent.classList.add('expanded');
                      pageContent.classList.add('expanded');
                      projectContent.classList.add('expanded');
                      
                      // Load frame preview if not already loaded
                      const preview = frameContent.querySelector('.figtree-frame-preview');
                      if (preview && preview.querySelector('.figtree-frame-preview-loading')) {
                        loadFramePreview(projectKey, frame, preview);
                      }
                    }
                  }
                }
              }
            }
            
            pageElement.classList.toggle('hidden', !pageHasVisibleContent);
            if (pageHasVisibleContent) {
              pageContent.classList.add('expanded');
              projectContent.classList.add('expanded');
              hasVisibleContent = true;
            }
          }
        }
      }
      
      project.classList.toggle('hidden', !hasVisibleContent);
    }
  });
  
  return container;
}

// Parse Figma file key from URL
function parseFileKey(url) {
  try {
    const figmaUrl = new URL(url);
    if (!figmaUrl.hostname.includes('figma.com')) return null;
    
    // Handle different Figma URL formats
    const fileMatch = figmaUrl.pathname.match(/(?:file|design)\/(.*?)(\/.*)?$/);
    return fileMatch ? fileMatch[1] : null;
  } catch {
    return null;
  }
}

// Show error message
function showError(message) {
  const container = panelState.container;
  if (!container) return;
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'figtree-error-toast';
  errorDiv.textContent = message;
  
  container.appendChild(errorDiv);
  
  // Add error toast styles if not already added
  if (!document.querySelector('#figtree-error-styles')) {
    const style = document.createElement('style');
    style.id = 'figtree-error-styles';
    style.textContent = `
      .figtree-error-toast {
        position: absolute;
        bottom: -48px;
        left: 50%;
        transform: translateX(-50%);
        background: #FF3B30;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        animation: figtree-toast 3s ease-in-out forwards;
      }
      
      @keyframes figtree-toast {
        0% { opacity: 0; transform: translate(-50%, 10px); }
        10% { opacity: 1; transform: translate(-50%, 0); }
        90% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -10px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Remove error after animation
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Create a project item
function createProjectItem(project) {
  const projectElement = document.createElement('div');
  projectElement.className = 'figtree-project';
  projectElement.innerHTML = `
    <div class="figtree-project-header">
      <span class="figtree-project-name">${project.name}</span>
      <div class="figtree-project-actions">
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${project.key}"></button>
        <button class="figtree-pin-button" title="Pin item">
          <span class="material-symbols-outlined">push_pin</span>
        </button>
        <button class="figtree-remove-btn" data-key="${project.key}">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
    <div class="figtree-project-content">
      <div class="figtree-pages"></div>
    </div>
  `;
  
  // Add styles if not already added
  if (!document.querySelector('#figtree-project-styles')) {
    const style = document.createElement('style');
    style.id = 'figtree-project-styles';
    style.textContent = `      
      .figtree-remove-btn {
        opacity: 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        padding: 4px;
        cursor: pointer;
        transition: opacity 0.2s, color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      
      .figtree-remove-btn:hover {
        color: #FF3B30;
        background: rgba(255, 59, 48, 0.1);
      }
      
      .figtree-remove-btn .material-symbols-outlined {
        font-size: 16px;
      }
      
      .figtree-project-header:hover .figtree-remove-btn {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add click handler for project header
  const projectHeader = projectElement.querySelector('.figtree-project-header');
  projectHeader.addEventListener('click', async (e) => {
    // Don't expand if clicking buttons
    if (e.target.closest('.figtree-project-actions')) return;
    
    const content = projectElement.querySelector('.figtree-project-content');
    if (!content.classList.contains('expanded')) {
      content.classList.add('expanded');
      await fetchProjectPages(project.key, content.querySelector('.figtree-pages'));
    } else {
      content.classList.remove('expanded');
    }
  });
  
  // Add pin button handler
  const pinButton = projectElement.querySelector('.figtree-pin-button');
  const url = `https://www.figma.com/file/${project.key}`;
  
  // Check if item is pinned
  chrome.storage.sync.get(['pinnedItems'], (result) => {
    const pinnedItems = result.pinnedItems || [];
    if (pinnedItems.some(item => item.url === url)) {
      pinButton.classList.add('pinned');
    }
  });

  // Add pin/unpin handler
  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isPinned = pinButton.classList.contains('pinned');
    if (isPinned) {
      await unpinItem(url);
      pinButton.classList.remove('pinned');
    } else {
      await pinItem(url, project.name);
      pinButton.classList.add('pinned');
    }
  });
  
  // Add copy button handler
  projectElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  });
  
  // Add remove button handler
  projectElement.querySelector('.figtree-remove-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const key = e.target.closest('.figtree-remove-btn').dataset.key;
    
    try {
      // Get current projects
      const { figmaProjects = [] } = await chrome.storage.local.get('figmaProjects');
      
      // Remove the project
      const updatedProjects = figmaProjects.filter(p => p.key !== key);
      await chrome.storage.local.set({ figmaProjects: updatedProjects });
      
      // Remove from cache
      nodeCache.delete(key);
      
      // Refresh projects list
      chrome.runtime.sendMessage({ action: 'refreshProjects' });
      
      // Show success message
      showSuccess('Project removed');
    } catch (error) {
      showError('Failed to remove project');
    }
  });
  
  return projectElement;
}

// Create a page item
function createPageItem(page, projectKey) {
  const pageElement = document.createElement('div');
  pageElement.className = 'figtree-page';
  pageElement.setAttribute('data-page-id', page.id);
  pageElement.innerHTML = `
    <div class="figtree-page-header">
      <span class="figtree-page-name">${page.name}</span>
      <div class="figtree-page-actions">
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${projectKey}?node-id=${page.id}"></button>
        <button class="figtree-pin-button" title="Pin item">
          <span class="material-symbols-outlined">push_pin</span>
        </button>
      </div>
    </div>
    <div class="figtree-page-content">
      <div class="figtree-frames"></div>
    </div>
  `;
  
  // Add click handler for page header
  pageElement.querySelector('.figtree-page-header').addEventListener('click', async () => {
    const content = pageElement.querySelector('.figtree-page-content');
    if (!content.classList.contains('expanded')) {
      content.classList.add('expanded');
      await fetchPageFrames(projectKey, page.id, content.querySelector('.figtree-frames'));
    } else {
      content.classList.remove('expanded');
    }
  });
  
  // Add pin button handler
  const pinButton = pageElement.querySelector('.figtree-pin-button');
  const url = `https://www.figma.com/file/${projectKey}?node-id=${page.id}`;
  
  // Check if item is pinned
  chrome.storage.sync.get(['pinnedItems'], (result) => {
    const pinnedItems = result.pinnedItems || [];
    if (pinnedItems.some(item => item.url === url)) {
      pinButton.classList.add('pinned');
    }
  });

  // Add pin/unpin handler
  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isPinned = pinButton.classList.contains('pinned');
    if (isPinned) {
      await unpinItem(url);
      pinButton.classList.remove('pinned');
    } else {
      await pinItem(url, page.name);
      pinButton.classList.add('pinned');
    }
  });
  
  // Add copy button handler
  pageElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  });
  
  return pageElement;
}

// Create a frame item
function createFrameItem(fileKey, frame) {
  const frameElement = document.createElement('div');
  frameElement.className = 'figtree-frame';
  frameElement.setAttribute('data-frame-id', frame.id);
  frameElement.innerHTML = `
    <div class="figtree-frame-header">
      <span class="figtree-frame-name">${frame.name}</span>
      <div class="figtree-frame-actions">
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${fileKey}?node-id=${frame.id}"></button>
        <button class="figtree-pin-button" title="Pin item">
          <span class="material-symbols-outlined">push_pin</span>
        </button>
      </div>
    </div>
    <div class="figtree-frame-content">
      <div class="figtree-frame-preview">
        <span class="figtree-frame-preview-loading">Loading preview...</span>
      </div>
      <div class="figtree-frame-groups"></div>
    </div>
  `;

  // Add styles if not already added
  if (!document.querySelector('#figtree-frame-styles')) {
    const style = document.createElement('style');
    style.id = 'figtree-frame-styles';
    style.textContent = `
      .figtree-frame-content {
        display: none;
      }
      
      .figtree-frame-content.expanded {
        display: block;
      }
      
      .figtree-frame-preview {
        margin: 4px 18px 8px;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #424242;
        position: relative;
        min-height: 120px;
      }
      
      .figtree-frame-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      
      .figtree-frame-tip {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(35, 128, 32, 0.8);
        color: white;
        border: 1px solid green;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 12px;
        display: flex;
        align-items: center;
        grid-template-columns: repeat(auto-fit, minmax(20px, 130px));
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 1;
        pointer-events: none;
        max-width: 114px;
        backdrop-filter: blur(5px);
      }
      
      .figtree-frame-preview:hover .figtree-frame-tip {
        opacity: 1;
      }
      
      .figtree-frame-tip .material-symbols-outlined {
        font-size: 16px;
      }
      
      .figtree-frame.expanded {
        padding-bottom: 8px;
      }
      
      .figtree-frame.expanded:hover {
        background: #3d3d3d;
      }
      
      .figtree-frame-groups {
        margin-left: 4px;
      }
      
      .figtree-group {
        margin: 4px 0;
      }
      
      .figtree-group-header {
        padding: 6px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 4px;
      }
      
      .figtree-group-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .figtree-frame-preview-loading {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
        font-weight: 500;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.05) 25%,
          rgba(255, 255, 255, 0.1) 50%,
          rgba(255, 255, 255, 0.05) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Add click handler for frame header
  const frameHeader = frameElement.querySelector('.figtree-frame-header');
  frameHeader.addEventListener('click', async (e) => {
    // Don't expand if clicking buttons
    if (e.target.closest('.figtree-frame-actions')) return;

    const content = frameElement.querySelector('.figtree-frame-content');
    const preview = content.querySelector('.figtree-frame-preview');
    const groups = content.querySelector('.figtree-frame-groups');
    
    frameElement.classList.toggle('expanded');
    content.classList.toggle('expanded');

    // Hide content when collapsing
    if (!frameElement.classList.contains('expanded')) {
      return;
    }

    // Load preview and groups if expanding
    try {
      // Get image URL for the frame
      const [imageResponse, nodeResponse] = await Promise.all([
        fetch(`${FIGMA_API_BASE}/images/${fileKey}?ids=${frame.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }),
        fetch(`${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${frame.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
      ]);

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const imageUrl = imageData.images[frame.id];

        if (imageUrl) {
          preview.innerHTML = `
            <div class="figtree-frame-preview-loading">Loading preview...</div>
            <div class="figtree-frame-tip">
              <span class="material-symbols-outlined">right_click</span>
              Right-click to copy image
            </div>
            <img src="${imageUrl}" alt="${frame.name}" loading="lazy">
          `;

          // Add load event listener to the image
          const img = preview.querySelector('img');
          img.addEventListener('load', () => {
            const loadingElement = preview.querySelector('.figtree-frame-preview-loading');
            if (loadingElement) {
              loadingElement.remove();
            }
          });
        }
      }

      if (nodeResponse.ok) {
        const nodeData = await nodeResponse.json();
        const frameData = nodeData.nodes[frame.id];

        if (frameData && frameData.document && frameData.document.children) {
          groups.innerHTML = ''; // Clear existing groups
          
          // Add groups, filtering out those with fignore layers
          frameData.document.children.forEach(child => {
            if (child.type === 'GROUP' && !hasFignoreLayer(child)) {
              const groupElement = createGroupItem(child, fileKey);
              groups.appendChild(groupElement);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading frame content:', error);
      content.innerHTML = '<div class="figtree-error">Failed to load frame content</div>';
    }
  });

  // Add pin button handler
  const pinButton = frameElement.querySelector('.figtree-pin-button');
  const url = `https://www.figma.com/file/${fileKey}?node-id=${frame.id}`;
  
  // Check if item is pinned
  chrome.storage.sync.get(['pinnedItems'], (result) => {
    const pinnedItems = result.pinnedItems || [];
    if (pinnedItems.some(item => item.url === url)) {
      pinButton.classList.add('pinned');
    }
  });

  // Add pin/unpin handler
  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isPinned = pinButton.classList.contains('pinned');
    if (isPinned) {
      await unpinItem(url);
      pinButton.classList.remove('pinned');
    } else {
      const preview = frameElement.querySelector('.figtree-frame-preview img')?.src;
      await pinItem(url, frame.name, preview);
      pinButton.classList.add('pinned');
    }
  });

  // Add copy button handler
  frameElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  });
  
  return frameElement;
}

// Create a group item
function createGroupItem(group, fileKey) {
  const groupElement = document.createElement('div');
  groupElement.className = 'figtree-group';
  groupElement.setAttribute('data-group-id', group.id);
  groupElement.innerHTML = `
    <div class="figtree-group-header">
      <span class="figtree-group-name">${group.name}</span>
      <div class="figtree-group-actions">
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${fileKey}?node-id=${group.id}"></button>
        <button class="figtree-pin-button" title="Pin item">
          <span class="material-symbols-outlined">push_pin</span>
        </button>
      </div>
    </div>
  `;
  
  // Add pin button handler
  const pinButton = groupElement.querySelector('.figtree-pin-button');
  const url = `https://www.figma.com/file/${fileKey}?node-id=${group.id}`;
  
  // Check if item is pinned
  chrome.storage.sync.get(['pinnedItems'], (result) => {
    const pinnedItems = result.pinnedItems || [];
    if (pinnedItems.some(item => item.url === url)) {
      pinButton.classList.add('pinned');
    }
  });

  // Add pin/unpin handler
  pinButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isPinned = pinButton.classList.contains('pinned');
    if (isPinned) {
      await unpinItem(url);
      pinButton.classList.remove('pinned');
    } else {
      await pinItem(url, group.name);
      pinButton.classList.add('pinned');
    }
  });
  
  // Add copy button handler
  groupElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  });
  
  return groupElement;
}

// Fetch pages for a project
async function fetchProjectPages(projectKey, container) {
  try {
    // Check cache first
    if (!nodeCache.has(projectKey)) {
      container.innerHTML = '<div class="figtree-loading">Loading...</div>';
      const response = await fetch(`${FIGMA_API_BASE}/files/${projectKey}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch project pages');
      
      const data = await response.json();
      nodeCache.set(projectKey, data);
      
      // Pre-fetch all frames and groups
      const nodeIds = [];
      data.document.children.forEach(page => {
        nodeIds.push(page.id);
        if (page.children) {
          page.children.forEach(child => {
            if (child.type === 'FRAME') {
              nodeIds.push(child.id);
            }
          });
        }
      });
      
      if (nodeIds.length > 0) {
        const batchResponse = await fetch(`${FIGMA_API_BASE}/files/${projectKey}/nodes?ids=${nodeIds.join(',')}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          Object.entries(batchData.nodes).forEach(([nodeId, node]) => {
            nodeCache.set(`${projectKey}_${nodeId}`, node);
          });
        }
      }
    }
    
    const data = nodeCache.get(projectKey);
    container.innerHTML = ''; // Clear existing content
    
    data.document.children.forEach(page => {
      container.appendChild(createPageItem(page, projectKey));
    });
  } catch (error) {
    console.error('Error fetching project pages:', error);
    container.innerHTML = '<div class="figtree-error">Failed to load pages</div>';
  }
}

// Function to check if a node has a fignore child layer
function hasFignoreLayer(node) {
  // If the node has no children, return false
  if (!node.children) return false;
  
  // Only check direct children for fignore layer
  return node.children.some(child => child.name === "fignore");
}

// Fetch frames within a page
async function fetchPageFrames(projectKey, pageId, container) {
  try {
    const cacheKey = `${projectKey}_${pageId}`;
    let pageData;
    
    if (nodeCache.has(cacheKey)) {
      pageData = nodeCache.get(cacheKey);
    } else {
      container.innerHTML = '<div class="figtree-loading">Loading...</div>';
      const response = await fetch(`${FIGMA_API_BASE}/files/${projectKey}/nodes?ids=${pageId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch page frames');
      
      const data = await response.json();
      pageData = data.nodes[pageId];
      nodeCache.set(cacheKey, pageData);
    }
    
    container.innerHTML = ''; // Clear existing content
    
    if (pageData && pageData.document && pageData.document.children) {
      // Create an array of frames, filter out those with fignore layers, and reverse their order
      const frames = pageData.document.children
        .filter(frame => {
          if (frame.type !== 'FRAME') return false;
          
          // Check if this frame has a fignore layer
          const hasFignore = hasFignoreLayer(frame);
          return !hasFignore;
        })
        .reverse();  
      // Add frames in reversed order
      frames.forEach(frame => {
        container.appendChild(createFrameItem(projectKey, frame));
      });
    } else {
      console.error('Invalid page data structure:', pageData);
      container.innerHTML = '<div class="figtree-error">Invalid page data structure</div>';
    }
  } catch (error) {
    console.error('Error in fetchPageFrames:', error);
    container.innerHTML = '<div class="figtree-error">Failed to load frames</div>';
  }
}

// Fetch groups within a frame
async function fetchFrameGroups(fileKey, pageId, container) {
  try {
    // Check cache first
    const cacheKey = `${fileKey}_${pageId}`;
    if (!nodeCache.has(cacheKey)) {
      const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${pageId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch frames');
      
      const data = await response.json();
      nodeCache.set(cacheKey, data.nodes[pageId]);
    }
    
    const pageData = nodeCache.get(cacheKey);
    if (!pageData || !pageData.document || !pageData.document.children) {
      throw new Error('Invalid page data');
    }
    
    container.innerHTML = '';
    
    // Add frames and groups, filtering out those with fignore layers
    pageData.document.children.forEach(child => {
      if ((child.type === 'FRAME' || child.type === 'GROUP') && !hasFignoreLayer(child)) {
        container.appendChild(createFrameItem(fileKey, child));
      }
    });
    
  } catch (error) {
    console.error('Error fetching frames:', error);
    container.innerHTML = '<div class="figtree-error">Failed to load frames</div>';
  }
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback to execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showProjects') {
    // Create and show UI immediately with loading state
    const container = createFigtreeUI();
    const projectsContainer = container.querySelector('.figtree-projects');
    
    // Show loading state with placeholder items
    projectsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      projectsContainer.appendChild(createLoadingItem('Loading projects...'));
    }
    
    // Send response immediately
    sendResponse({ success: true });
    return false; // We're not sending an async response
  }
  
  if (message.action === 'closePanel') {
    // Find and remove any existing panels
    if (panelState.container) {
      panelState.container.remove();
      panelState.container = null;
      panelState.isOpen = false;
    }
    sendResponse({ success: true });
    return false;
  }
  
  if (message.action === 'updateProjects') {
    // If panel was closed, don't update
    if (!panelState.isOpen || !panelState.container) {
      sendResponse({ success: false, error: 'Panel is closed' });
      return false;
    }
    
    accessToken = message.accessToken;
    const projectsContainer = panelState.container.querySelector('.figtree-projects');
    if (!projectsContainer) {
      sendResponse({ success: false, error: 'Projects container not found' });
      return false;
    }
    
    // Load projects asynchronously
    Promise.all(message.projects.map(async project => {
      try {
        // Check cache first
        if (!nodeCache.has(project.key)) {
          // Fetch file data
          const fileResponse = await fetch(`${FIGMA_API_BASE}/files/${project.key}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (!fileResponse.ok) throw new Error('Failed to fetch project data');
          
          const fileData = await fileResponse.json();
          nodeCache.set(project.key, fileData);
          
          // Get the root node ID from the file data
          const rootNodeId = fileData.document.id;
          
          // Fetch root node data
          const nodesResponse = await fetch(`${FIGMA_API_BASE}/files/${project.key}/nodes?ids=${rootNodeId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (nodesResponse.ok) {
            const nodesData = await nodesResponse.json();
            Object.entries(nodesData.nodes).forEach(([nodeId, node]) => {
              nodeCache.set(`${project.key}_${nodeId}`, node);
            });
          }
        }
        
        return {
          ...project,
          data: nodeCache.get(project.key)
        };
      } catch (error) {
        console.error('Error loading project:', error);
        return project;
      }
    })).then(projects => {
      // Check if panel is still open
      if (!panelState.isOpen || !panelState.container) {
        sendResponse({ success: false, error: 'Panel was closed during update' });
        return;
      }
      
      // Clear loading state
      projectsContainer.innerHTML = '';
      
      if (projects.length === 0) {
        projectsContainer.innerHTML = '<div class="figtree-empty"><img src="https://files.getfigtree.com/figtree-projects-empty.png" alt="No projects found" class="figtree-projects-empty-image"><br/>No projects found. Add a project above to get started.</div>';
      } else {
        // Add project items
        projects.forEach(project => {
          projectsContainer.appendChild(createProjectItem(project));
        });
      }
      
      sendResponse({ success: true });
    }).catch(error => {
      if (panelState.isOpen && panelState.container) {
        projectsContainer.innerHTML = '<div class="figtree-error">Failed to load projects</div>';
      }
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // We will send a response asynchronously
  }
  
  return false; // We don't handle any other messages
});

// Create a loading item
function createLoadingItem(text = 'Loading...') {
  const loadingElement = document.createElement('div');
  loadingElement.className = 'figtree-loading-item';
  loadingElement.innerHTML = `
    <div class="figtree-loading-header">
      <span class="figtree-loading-text">${text}</span>
    </div>
  `;
  return loadingElement;
}

// Show success message
function showSuccess(message) {
  const container = panelState.container;
  if (!container) return;
  
  const successDiv = document.createElement('div');
  successDiv.className = 'figtree-success-toast';
  successDiv.textContent = message;
  
  container.appendChild(successDiv);
  
  // Add success toast styles if not already added
  if (!document.querySelector('#figtree-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'figtree-toast-styles';
    style.textContent = `
      .figtree-success-toast {
        position: absolute;
        bottom: -48px;
        left: 50%;
        transform: translateX(-50%);
        background: #34C759;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        animation: figtree-toast 3s ease-in-out forwards;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Remove success message after animation
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

// Add this new function to handle frame preview loading
async function loadFramePreview(fileKey, frame, previewContainer) {
  try {
    const imageResponse = await fetch(`${FIGMA_API_BASE}/images/${fileKey}?ids=${frame.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (imageResponse.ok) {
      const imageData = await imageResponse.json();
      const imageUrl = imageData.images[frame.id];

      if (imageUrl) {
        previewContainer.innerHTML = `
          <div class="figtree-frame-preview-loading">Loading preview...</div>
          <div class="figtree-frame-tip">
            <span class="material-symbols-outlined">right_click</span>
            Right-click to copy image
          </div>
          <img src="${imageUrl}" alt="${frame.name}" loading="lazy" onload="this.parentElement.querySelector('.figtree-frame-preview-loading').remove()">
        `;
      }
    }
  } catch (error) {
    console.error('Error loading frame preview:', error);
    previewContainer.innerHTML = '<div class="figtree-error">Failed to load preview</div>';
  }
} 