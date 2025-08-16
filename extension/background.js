// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_OAUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
let accessToken = null;

// Debug logging function
function debugLog(message, data = null) {
  console.log(`[Treekit] ${message}`, data || '');
}

// Generate a random state string
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// PKCE utility functions
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(array) {
  const base64 = btoa(String.fromCharCode.apply(null, array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Get the website auth URL
function getWebsiteAuthUrl() {
  const websiteAuthUrl = 'https://www.gettreekit.com/auth.html';
  debugLog('Using production auth URL:', websiteAuthUrl);
  return websiteAuthUrl;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
  debugLog('Exchanging code for token');
  try {
    const clientId = chrome.runtime.getManifest().oauth2.client_id;
    // Use the same redirect URI as the website auth page
    const redirectUri = 'https://www.gettreekit.com/auth.html';
    
    debugLog('Using client ID:', clientId);
    debugLog('Using redirect URI:', redirectUri);
    
    // Try direct token exchange with Figma API first
    debugLog('Attempting direct token exchange with Figma API');
    
    // For Chrome extensions, we can try the direct approach since the client_id is public anyway
    const tokenUrl = 'https://api.figma.com/v1/oauth/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'client_id': clientId,
        'client_secret': '', // Extensions can't securely store client secrets
        'redirect_uri': redirectUri,
        'code': code,
        'grant_type': 'authorization_code'
      })
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      debugLog('Direct token exchange successful');
      return tokenData.access_token;
    }

    // If direct approach fails, try the Chrome identity API approach
    debugLog('Direct token exchange failed, trying Chrome identity API');
    
    try {
      // Use Chrome's identity API for OAuth2 token exchange
      const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=files:read&response_type=token&state=${Math.random().toString(36)}`;
      
      const authResult = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      if (authResult) {
        // Extract access token from the result URL
        const url = new URL(authResult);
        const token = url.searchParams.get('access_token') || 
                     url.hash.match(/access_token=([^&]+)/)?.[1];
        
        if (token) {
          debugLog('Chrome identity API token exchange successful');
          return token;
        }
      }
    } catch (identityError) {
      debugLog('Chrome identity API failed:', identityError);
    }

    // If both methods fail, try external service as fallback
    debugLog('Trying external token exchange service as fallback');
    
    const response = await fetch('https://www.gettreekit.com/server/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLog('External token exchange failed:', errorText);
      throw new Error('All token exchange methods failed. Please check your OAuth configuration.');
    }

    const data = await response.json();
    debugLog('External token exchange successful');
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
  chrome.storage.local.get(['treekit_access_token'], function(result) {
    debugLog('Checking stored token:', result);
    if (result.treekit_access_token) {
      accessToken = result.treekit_access_token;
      debugLog('Found stored token');
    }
  });
});

// Listen for messages from content script and OAuth page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
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
    chrome.storage.local.get(['treekit_access_token'], function(result) {
      debugLog('Retrieved token from storage:', result.treekit_access_token ? 'exists' : 'not found');
      if (result.treekit_access_token) {
        accessToken = result.treekit_access_token; // Update in-memory token
      }
      resolve(result.treekit_access_token || null);
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
    return response.ok;
  } catch (error) {
    debugLog('Error verifying token:', error);
    return false;
  }
}

// Start website-based OAuth flow
async function startWebsiteAuthFlow() {
  debugLog('Starting website-based OAuth flow');
  try {
    const state = generateState();
    
    debugLog('Generated OAuth state:', state);
    
    // Store the state for verification
    await chrome.storage.local.set({ 
      oauth_state: state,
      oauth_timestamp: Date.now()
    });
    debugLog('Stored OAuth state and timestamp');
    
    // Open website auth page with state parameter
    const websiteAuthUrl = getWebsiteAuthUrl();
    const authUrl = `${websiteAuthUrl}?extension_state=${state}`;
    
    debugLog('Opening website auth URL:', authUrl);
    
    // Open the website auth URL in a new tab
    const authTab = await chrome.tabs.create({ url: authUrl });
    debugLog('Created auth tab:', authTab.id);
    
    // Start polling for completed authentication
    startWebsiteAuthPolling(state, authTab.id);
  } catch (error) {
    debugLog('Error starting website auth flow:', error);
    throw error;
  }
}

// Website-based auth polling
let websiteAuthPollingInterval = null;
let websiteAuthTabListener = null;

function startWebsiteAuthPolling(expectedState, authTabId) {
  debugLog('Starting website auth polling for state:', expectedState);
  debugLog('Tracking auth tab ID:', authTabId);
  
  // Clear any existing polling
  if (websiteAuthPollingInterval) {
    clearInterval(websiteAuthPollingInterval);
    websiteAuthPollingInterval = null;
  }

  // Remove any existing tab listener
  if (websiteAuthTabListener) {
    chrome.tabs.onUpdated.removeListener(websiteAuthTabListener);
    websiteAuthTabListener = null;
  }

  // Poll the website for authentication completion
  debugLog('Setting up website auth polling every 2 seconds');
  websiteAuthPollingInterval = setInterval(async () => {
    try {
      debugLog(`Polling website for auth completion...`);
      await checkWebsiteForAuthResult(expectedState, authTabId);
    } catch (error) {
      debugLog('Error during website auth polling:', error);
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 5 minutes
  setTimeout(() => {
    if (websiteAuthPollingInterval) {
      debugLog('Website auth polling timeout - stopped after 5 minutes');
      cleanupWebsiteAuthPolling();
    }
  }, 300000);
}

// Check website for authentication result by injecting script
async function checkWebsiteForAuthResult(expectedState, authTabId) {
  try {
    // Check if the auth tab still exists
    const tab = await chrome.tabs.get(authTabId).catch(() => null);
    if (!tab) {
      debugLog(`Auth tab ${authTabId} no longer exists`);
      cleanupWebsiteAuthPolling();
      return;
    }
    
    debugLog(`Checking tab for auth result via script injection...`);
    
    // Only check if we're on our website
    if (!tab.url || !tab.url.includes('gettreekit.com')) {
      debugLog(`Tab URL not on gettreekit.com, skipping: ${tab.url}`);
      return;
    }
    
    // Inject script to check for auth completion
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: authTabId },
        func: () => {
          try {
            // Check sessionStorage for auth result
            const authResult = sessionStorage.getItem('treekit_auth_result');
            if (authResult) {
              const parsed = JSON.parse(authResult);
              // Clear the result so it's only consumed once
              sessionStorage.removeItem('treekit_auth_result');
              return { success: true, data: parsed };
            }
            return { success: false, message: 'No auth result found' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
    } catch (scriptError) {
      debugLog(`Script injection failed for tab ${authTabId}:`, scriptError.message);
      return;
    }
    
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      
      if (result.success && result.data) {
        const authData = result.data;
        debugLog('Found auth result from website:', { type: authData.type, hasToken: !!(authData.access_token || authData.code) });
        
        cleanupWebsiteAuthPolling();
        
        // Handle the auth result (auth tab will redirect to welcome page)
        if (authData.type === 'access_token' && authData.access_token) {
          await handleDirectTokenResponse(authData.access_token, authData.state || expectedState);
        } else if (authData.type === 'authorization_code' && authData.code) {
          await handleOAuthResponse(authData.code, authData.state || expectedState);
        }
      }
    }
  } catch (error) {
    debugLog('Error checking website for auth result:', error.message);
  }
}

// Clean up website auth polling resources
function cleanupWebsiteAuthPolling() {
  if (websiteAuthPollingInterval) {
    clearInterval(websiteAuthPollingInterval);
    websiteAuthPollingInterval = null;
  }
  
  if (websiteAuthTabListener) {
    chrome.tabs.onUpdated.removeListener(websiteAuthTabListener);
    websiteAuthTabListener = null;
  }
  
  debugLog('Website auth polling cleanup completed');
}

// Legacy OAuth cleanup code - kept for any remaining references
function cleanupPolling() {
  // No longer used, but kept for compatibility
  debugLog('Legacy OAuth polling cleanup called');
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
    const { treekit_projects = [] } = await chrome.storage.local.get('treekit_projects');
    debugLog('Stored projects:', treekit_projects);
    
    return treekit_projects;
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
      accessToken = await getAccessToken();
    }
    
    if (!accessToken) {
      debugLog('No access token found, starting website auth flow');
      await startWebsiteAuthFlow();
      return;
    }

    // Verify token is still valid
    const isValid = await verifyToken(accessToken);
    if (!isValid) {
      debugLog('Token is invalid, starting website auth flow');
      accessToken = null;
      await chrome.storage.local.remove('treekit_access_token');
      await startWebsiteAuthFlow();
      return;
    }
    
    // Token is valid, show panel and fetch projects
    await injectContentScript(tab);
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
    await startWebsiteAuthFlow();
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
    // Inject config and content scripts
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['config.js', 'content.js']
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

// Handle direct token response from implicit flow
async function handleDirectTokenResponse(token, state) {
  try {
    debugLog('Handling direct token response');
    
    // Validate state parameter
    const { oauth_state } = await chrome.storage.local.get(['oauth_state']);
    if (!oauth_state) {
      throw new Error('No stored OAuth state found');
    }
    
    if (state !== oauth_state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }
    
    debugLog('State validation successful');
    
    // Store the token directly
    await chrome.storage.local.set({ treekit_access_token: token });
    accessToken = token;
    
    // Clean up OAuth state
    await chrome.storage.local.remove(['oauth_state']);
    
    debugLog('Direct token flow completed successfully');
    
    // Broadcast the new authorization state to all tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'authorizationStateChanged',
          isAuthorized: true
        });
      } catch (error) {
        // Ignore errors for tabs where content script isn't loaded
        console.debug('Could not send message to tab:', tab.id);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error handling direct token response:', error);
    // Clean up any stored OAuth data on error
    await chrome.storage.local.remove(['oauth_state']);
    throw error;
  }
}

// Handle OAuth response
async function handleOAuthResponse(code, state) {
  try {
    debugLog('Handling OAuth response with code and state');
    
    // Validate state parameter
    const { oauth_state } = await chrome.storage.local.get(['oauth_state']);
    if (!oauth_state) {
      throw new Error('No stored OAuth state found');
    }
    
    if (state !== oauth_state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }
    
    debugLog('State validation successful');
    
    // Exchange code for token
    const token = await exchangeCodeForToken(code);
    
    // Store the token
    await chrome.storage.local.set({ treekit_access_token: token });
    accessToken = token;
    
    // Clean up OAuth state
    await chrome.storage.local.remove(['oauth_state']);
    
    debugLog('OAuth flow completed successfully');
    
    // Broadcast the new authorization state to all tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'authorizationStateChanged',
          isAuthorized: true
        });
      } catch (error) {
        // Ignore errors for tabs where content script isn't loaded
        console.debug('Could not send message to tab:', tab.id);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error handling OAuth response:', error);
    // Clean up any stored OAuth data on error
    await chrome.storage.local.remove(['oauth_state', 'oauth_code_verifier']);
    throw error;
  }
}