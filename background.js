// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_OAUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';

// OAuth configuration
const IS_PRODUCTION = true; // This should match config.js
const OAUTH_REDIRECT_URL = IS_PRODUCTION
  ? 'https://getfigtree.com/oauth.html'
  : chrome.runtime.getURL('oauth.html');

let accessToken = null;

// Debug logging function
function debugLog(message, data = null) {
  //console.log(`[Figtree] ${message}`, data || '');
}

// Generate a random state string
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Get the extension's redirect URL
function getRedirectUrl() {
  return OAUTH_REDIRECT_URL;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
  debugLog('Exchanging code for token');
  try {
    const clientId = chrome.runtime.getManifest().oauth2.client_id;
    const clientSecret = chrome.runtime.getManifest().oauth2.client_secret;
    const redirectUri = getRedirectUrl();
    
    debugLog('Using client ID:', clientId);
    debugLog('Using redirect URI:', redirectUri);
    
    const formData = new URLSearchParams();
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    formData.append('redirect_uri', redirectUri);
    formData.append('code', code);
    formData.append('grant_type', 'authorization_code');

    debugLog('Sending token exchange request to:', FIGMA_TOKEN_URL);
    const response = await fetch(FIGMA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLog('Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    debugLog('Token exchange successful');
    return data.access_token;
  } catch (error) {
    debugLog('Error exchanging code for token:', error);
    throw error;
  }
}

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener(() => {
  debugLog('Extension installed/updated');
  
  // Check if we have a stored access token
  chrome.storage.local.get(['figma_access_token'], function(result) {
    debugLog('Checking stored token:', result);
    if (result.figma_access_token) {
      accessToken = result.figma_access_token;
      debugLog('Found stored token');
    }
  });
});

// Listen for messages from content script and OAuth page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'contentScriptReady' && message.needsAuthCheck) {
    // If we have a token in memory or storage, send it to the content script
    chrome.storage.local.get(['figma_access_token'], async (result) => {
      if (result.figma_access_token) {
        try {
          // Verify the token is still valid
          const isValid = await verifyToken(result.figma_access_token);
          if (isValid) {
            // Send the token to the content script
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'authorizationStateChanged',
              isAuthorized: true,
              accessToken: result.figma_access_token
            });
          }
        } catch (error) {
          console.debug('Error verifying token:', error);
        }
      }
    });
    return false;
  }

  if (message.action === 'checkAuthorization') {
    // Check if we have a valid token and send it to the content script
    chrome.storage.local.get(['figma_access_token'], async (result) => {
      if (result.figma_access_token) {
        try {
          // Verify the token is still valid
          const isValid = await verifyToken(result.figma_access_token);
          if (isValid) {
            // Send the token to the content script
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'authorizationStateChanged',
              isAuthorized: true,
              accessToken: result.figma_access_token
            });
            return;
          }
        } catch (error) {
          console.debug('Error verifying token:', error);
        }
      }
      // If we get here, we need to start the OAuth flow
      startOAuthFlow();
    });
    return false;
  }

  if (message.action === 'handleOAuthResponse') {
    console.log('Handling OAuth response:', message);
    handleOAuthResponse(message.code, message.state)
      .then(() => {
        console.log('OAuth response handled successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error handling OAuth response:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'refreshProjects') {
    // Get the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          const accessToken = await getAccessToken();
          if (!accessToken) {
            debugLog('No access token found');
            return;
          }
          
          const projects = await fetchProjects(accessToken);
          await sendMessageToContentScript(tabs[0].id, {
            action: 'updateProjects',
            accessToken,
            projects
          });
        } catch (error) {
          debugLog('Error refreshing projects:', error);
        }
      }
    });
  }
  
  if (message.action === 'copyImage') {
    // Handle image copying
    fetch(message.imageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${message.accessToken}`,
        'Accept': 'image/png',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': chrome.runtime.getURL('')
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      // Create a new blob with the correct type
      const newBlob = new Blob([blob], { type: 'image/png' });
      return navigator.clipboard.write([
        new ClipboardItem({
          'image/png': newBlob
        })
      ]);
    })
    .then(() => {
      sendResponse({ success: true });
    })
    .catch(error => {
      console.error('Error copying image:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Will respond asynchronously
  }

  if (message.action === 'downloadImage') {
    handleImageDownload(message.imageUrl, message.accessToken, message.fileName)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Get access token from storage
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['figma_access_token'], function(result) {
      debugLog('Retrieved token from storage:', result.figma_access_token ? 'exists' : 'not found');
      if (result.figma_access_token) {
        accessToken = result.figma_access_token; // Update in-memory token
      }
      resolve(result.figma_access_token || null);
    });
  });
}

// Verify token is valid
async function verifyToken(token) {
  try {
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      // Update in-memory token if valid
      accessToken = token;
      return true;
    }
    
    // If token is invalid, clear it
    accessToken = null;
    await chrome.storage.local.remove('figma_access_token');
    return false;
  } catch (error) {
    debugLog('Error verifying token:', error);
    // On error, clear token to be safe
    accessToken = null;
    await chrome.storage.local.remove('figma_access_token');
    return false;
  }
}

// Start OAuth flow
function startOAuthFlow() {
  debugLog('Starting OAuth flow');
  try {
    const clientId = chrome.runtime.getManifest().oauth2.client_id;
    const scopes = chrome.runtime.getManifest().oauth2.scopes.join(' ');
    const state = generateState();
    
    debugLog('Generated OAuth parameters:', {
      clientId,
      scopes,
      state
    });
    
    // Store the state for verification
    chrome.storage.local.set({ oauth_state: state }, () => {
      debugLog('Stored OAuth state');
    });
    
    const redirectUri = getRedirectUrl();
    debugLog('Using redirect URI:', redirectUri);
    
    const authUrl = `${FIGMA_OAUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
    
    debugLog('Opening OAuth URL:', authUrl);
    
    // Open the OAuth URL in a new tab
    chrome.tabs.create({ url: authUrl });
  } catch (error) {
    debugLog('Error starting OAuth flow:', error);
    throw error;
  }
}

// Fetch user's projects
async function fetchProjects(accessToken) {
  debugLog('Fetching projects...');
  try {
    // First verify our authentication
    const meResponse = await fetch(`${FIGMA_API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!meResponse.ok) {
      throw new Error(`Failed to verify authentication: ${meResponse.status}`);
    }
    
    const meData = await meResponse.json();
    debugLog('User data:', meData);
    
    // Get stored projects
    const { figmaProjects = [] } = await chrome.storage.local.get('figmaProjects');
    debugLog('Stored projects:', figmaProjects);
    
    return figmaProjects;
  } catch (error) {
    debugLog('Error in fetchProjects:', error);
    throw error;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  debugLog('Extension icon clicked');
  
  try {
    // First try to get token from memory
    if (!accessToken) {
      // If not in memory, try to get from storage
      const result = await chrome.storage.local.get(['figma_access_token']);
      if (result.figma_access_token) {
        accessToken = result.figma_access_token;
      }
    }
    
    if (!accessToken) {
      debugLog('No access token found, starting OAuth flow');
      startOAuthFlow();
      return;
    }

    // Verify token is still valid
    const isValid = await verifyToken(accessToken);
    if (!isValid) {
      debugLog('Token is invalid, starting OAuth flow');
      accessToken = null;
      await chrome.storage.local.remove('figma_access_token');
      startOAuthFlow();
      return;
    }

    // Token is valid, ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      // If script is already injected, this will fail, which is fine
      debugLog('Content script already injected or injection failed:', error);
    }

    // Show panel in the clicked tab
    await sendMessageToContentScript(tab.id, { 
      action: 'showProjects',
      accessToken,
      projects: [] 
    });

    // Fetch projects in background
    const projects = await fetchProjects(accessToken);
    await sendMessageToContentScript(tab.id, {
      action: 'updateProjects',
      accessToken,
      projects
    });
      
  } catch (error) {
    debugLog('Error:', error);
    startOAuthFlow();
  }
});

// Function to handle image download
async function handleImageDownload(imageUrl, accessToken, fileName) {
  try {
    // Fetch the image with proper headers
    const response = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'image/png'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the blob
    const blob = await response.blob();

    // Create a download URL
    const url = URL.createObjectURL(blob);

    // Create a download link and trigger it
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error in handleImageDownload:', error);
    throw error;
  }
}

// Function to inject content script
async function injectContentScript(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (error) {
    // If the script is already injected, this will fail, which is fine
    debugLog('Content script already injected or injection failed:', error);
  }
}

// Function to send message to content script
async function sendMessageToContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    debugLog('Error sending message to content script:', error);
    throw error;
  }
}

// Show projects in the UI
async function showProjects() {
  debugLog('Fetching projects...');
  try {
    // First verify our authentication
    const meResponse = await fetch(`${FIGMA_API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!meResponse.ok) {
      throw new Error(`Failed to verify authentication: ${meResponse.status}`);
    }
    
    const meData = await meResponse.json();
    debugLog('User data:', meData);
    
    // Fetch each file
    const projects = [];
    for (const fileKey of fileKeys) {
      const fileResponse = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!fileResponse.ok) {
        debugLog(`Failed to fetch file ${fileKey}:`, fileResponse.status);
        continue;
      }
      
      const fileData = await fileResponse.json();
      debugLog(`File data for ${fileKey}:`, fileData);
      
      projects.push({
        key: fileKey,
        name: fileData.name
      });
    }
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      debugLog('No active tab found');
      return;
    }
    
    // Inject the content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      debugLog('Content script injected successfully');
    } catch (error) {
      debugLog('Error injecting content script:', error);
      // If the script is already injected, this will fail, which is fine
    }
    
    // Wait for content script to be ready
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        debugLog('Timeout waiting for content script to be ready');
        resolve();
      }, 5000); // 5 second timeout
      
      const listener = (message, sender, sendResponse) => {
        if (message.action === 'contentScriptReady' && sender.tab?.id === tab.id) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          debugLog('Content script is ready');
          resolve();
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
    });
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: 'showProjects',
      projects,
      accessToken
    }, (response) => {
      if (chrome.runtime.lastError) {
        debugLog('Error sending message to content script:', chrome.runtime.lastError);
      } else {
        debugLog('Message sent successfully to content script:', response);
      }
    });
  } catch (error) {
    debugLog('Error in showProjects:', error);
    throw error;
  }
}

// Handle OAuth response
async function handleOAuthResponse(code, state) {
  try {
    // Exchange code for token
    const token = await exchangeCodeForToken(code);
    
    // Store the token
    await chrome.storage.local.set({ figma_access_token: token });
    accessToken = token;
    
    // Get all tabs and inject content script
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map(async (tab) => {
      try {
        // First inject the content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Then send the authorization message
        await chrome.tabs.sendMessage(tab.id, {
          action: 'authorizationStateChanged',
          isAuthorized: true,
          accessToken: token
        });
      } catch (error) {
        // Ignore errors for tabs where content script isn't loaded
        console.debug('Could not send message to tab:', tab.id);
      }
    }));
    
    return true;
  } catch (error) {
    console.error('Error handling OAuth response:', error);
    throw error;
  }
}