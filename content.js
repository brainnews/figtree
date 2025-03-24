// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';

// Cache for API responses
const nodeCache = new Map();

// Keep track of panel state
let panelState = {
  isOpen: false,
  container: null
};

// Create and inject the Figtree UI
function createFigtreeUI() {
  // Remove any existing panel first
  if (panelState.container) {
    panelState.container.remove();
    panelState.isOpen = false;
  }
  
  const container = document.createElement('div');
  container.className = 'figtree-container';
  container.innerHTML = `
    <div class="figtree-header">
      <img src="https://files.milesgilbert.xyz/figtree-icon-transparent.png" alt="Figtree Logo" class="figtree-logo">
      <span class="figtree-title">Figtree</span>
      <button class="figtree-close">×</button>
    </div>
    <div class="figtree-add-project">
      <input type="text" class="figtree-url-input" placeholder="Paste Figma file URL...">
      <button class="figtree-add-button">
        <span class="material-symbols-outlined">add</span>
      </button>
    </div>
    <div class="figtree-projects"></div>
  `;
  
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
      width: 280px;
      max-height: 80vh;
      background: #2c2c2c;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    .figtree-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .figtree-logo {
      width: 34px;
      filter: grayscale(1) brightness(5);
    }
    
    .figtree-title {
      margin-left: 8px;
      font-size: 14px;
      font-weight: 500;
      flex-grow: 1;
    }
    
    .figtree-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    
    .figtree-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }

    .figtree-empty {
      padding: 20px;
      text-align: center;
    }

    .figtree-add-project {
      padding: 12px 16px;
      display: flex;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .figtree-url-input {
      flex-grow: 1;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 6px 12px;
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
    
    .figtree-projects {
      overflow-y: auto;
      padding: 8px 0;
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
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: opacity 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .figtree-copy-btn::before {
      content: 'content_copy';
      font-family: 'Material Icons';
      font-size: 14px;
    }
    
    .figtree-project-header:hover .figtree-copy-btn,
    .figtree-page-header:hover .figtree-copy-btn,
    .figtree-frame-header:hover .figtree-copy-btn,
    .figtree-group:hover .figtree-copy-btn {
      opacity: 1;
    }
    
    .figtree-copy-btn:hover {
      color: rgba(255, 255, 255, 0.9);
    }
    
    .figtree-copy-btn.copied {
      color: #64D2FF;
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
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(container);
  
  // Add close button handler
  container.querySelector('.figtree-close').addEventListener('click', () => {
    container.remove();
  });
  
  panelState.container = container;
  panelState.isOpen = true;
  
  // Add event listeners
  container.querySelector('.figtree-close').addEventListener('click', () => {
    container.remove();
    panelState.container = null;
    panelState.isOpen = false;
  });
  
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
      
      // Refresh projects list
      chrome.runtime.sendMessage({ action: 'refreshProjects' });
      
    } catch (error) {
      showError(error.message);
    } finally {
      addButton.disabled = false;
      urlInput.disabled = false;
    }
  };
  
  addButton.addEventListener('click', addProject);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addProject();
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
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${project.key}">Copy</button>
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
      .figtree-project-actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      
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
      
      .figtree-remove-btn .material-symbols-outlined, .figtree-remove-btn .material-symbols-outlined {
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
  
  // Add copy button handler
  projectElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
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
  pageElement.innerHTML = `
    <div class="figtree-page-header">
      <span class="figtree-page-name">${page.name}</span>
      <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${projectKey}?node-id=${page.id}">Copy</button>
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
  
  // Add copy button handler
  pageElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
  
  return pageElement;
}

// Create a frame item
function createFrameItem(fileKey, frame) {
  const frameElement = document.createElement('div');
  frameElement.className = 'figtree-frame';
  frameElement.innerHTML = `
    <div class="figtree-frame-header">
      <span class="figtree-frame-name">${frame.name}</span>
      <div class="figtree-frame-actions">
        <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${fileKey}?node-id=${frame.id}">Copy</button>
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
      }
      
      .figtree-frame-preview img {
        width: 100%;
        height: auto;
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
        color: #fff;
        font-size: 12px;
        font-weight: 500;
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
            <div class="figtree-frame-tip">
              <span class="material-symbols-outlined">right_click</span>
              Right-click to copy image
            </div>
            <img src="${imageUrl}" alt="${frame.name}" loading="lazy">
          `;
        }
      }

      if (nodeResponse.ok) {
        const nodeData = await nodeResponse.json();
        const frameData = nodeData.nodes[frame.id];

        if (frameData && frameData.document && frameData.document.children) {
          groups.innerHTML = ''; // Clear existing groups
          
          // Add groups
          frameData.document.children.forEach(child => {
            if (child.type === 'GROUP') {
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

  // Add copy button handler
  frameElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });

  return frameElement;
}

// Create a group item
function createGroupItem(group, fileKey) {
  const groupElement = document.createElement('div');
  groupElement.className = 'figtree-group';
  groupElement.innerHTML = `
    <div class="figtree-group-header">
      <span class="figtree-group-name">${group.name}</span>
      <button class="figtree-copy-btn" data-url="https://www.figma.com/file/${fileKey}?node-id=${group.id}">Copy</button>
    </div>
  `;
  
  // Add copy button handler
  groupElement.querySelector('.figtree-copy-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = e.target.dataset.url;
    await copyToClipboard(url);
    const btn = e.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
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
  
  // Check all direct children
  return node.children.some(child => {
    // Check if this child is named "fignore"
    if (child.name === "fignore") return true;
    
    // Recursively check children if this is a container node
    if (child.children) {
      return hasFignoreLayer(child);
    }
    
    return false;
  });
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
    
    if (pageData.document.children) {
      // Create an array of frames, filter out those with fignore layers, and reverse their order
      const frames = pageData.document.children
        .filter(frame => {
          if (frame.type !== 'FRAME') return false;
          
          // Check if this frame has a fignore layer
          return !hasFignoreLayer(frame);
        })
        .reverse();
      
      // Add frames in reversed order
      frames.forEach(frame => {
        container.appendChild(createFrameItem(projectKey, frame));
      });
    }
  } catch (error) {
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
    
    // Add frames, filtering out those with fignore layers
    pageData.document.children.forEach(frame => {
      if ((frame.type === 'FRAME' || frame.type === 'GROUP') && !hasFignoreLayer(frame)) {
        container.appendChild(createFrameItem(fileKey, frame));
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
let accessToken = null;

// Send ready message when content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptReady' });

// Update the message handler
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
          // Fetch project data
          const [fileResponse, nodesResponse] = await Promise.all([
            // Fetch file data
            fetch(`${FIGMA_API_BASE}/files/${project.key}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            // Fetch first level of nodes in parallel
            fetch(`${FIGMA_API_BASE}/files/${project.key}/nodes?ids=${project.key}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            })
          ]);
          
          if (!fileResponse.ok) throw new Error('Failed to fetch project data');
          
          const fileData = await fileResponse.json();
          nodeCache.set(project.key, fileData);
          
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
        projectsContainer.innerHTML = '<div class="figtree-empty">No projects found<br/><br/>Add a project by pasting the Figma file URL into the input field above.</div>';
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