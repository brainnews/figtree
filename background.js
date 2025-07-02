// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_OAUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
let accessToken = null;

// Debug logging function
function debugLog(message, data = null) {
  console.log(`[Figtree] ${message}`, data || '');
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

// Get the extension's redirect URL
function getRedirectUrl() {
  const extensionId = chrome.runtime.id;
  debugLog('Current extension ID:', extensionId);
  
  // For development, use external redirect (hardcoded for now)
  // TODO: Make this configurable based on environment
  const USE_EXTERNAL_REDIRECT = true; // Set to false for production
  const EXTERNAL_REDIRECT_URL = 'https://www.getfigtree.com/oauth.html';
  
  if (USE_EXTERNAL_REDIRECT) {
    debugLog('Using external redirect URL for development');
    return EXTERNAL_REDIRECT_URL;
  }
  
  // Default: use current extension ID (for production)
  const redirectUrl = `chrome-extension://${extensionId}/oauth.html`;
  debugLog('Using current extension ID redirect URL:', redirectUrl);
  
  return redirectUrl;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
  debugLog('Exchanging code for token');
  try {
    const clientId = chrome.runtime.getManifest().oauth2.client_id;
    const redirectUri = getRedirectUrl();
    
    debugLog('Using client ID:', clientId);
    debugLog('Using redirect URI:', redirectUri);
    
    // For external OAuth, we need to use a proxy service because
    // Figma requires client_secret which can't be stored in extensions
    const USE_EXTERNAL_REDIRECT = true; // Should match getRedirectUrl()
    
    if (USE_EXTERNAL_REDIRECT) {
      debugLog('Using external token exchange service');
      
      // Make request to your server that handles the token exchange
      const response = await fetch('https://www.getfigtree.com/api/oauth/token', {
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
        throw new Error('External token exchange failed. Server may be down.');
      }

      const data = await response.json();
      debugLog('External token exchange successful');
      return data.access_token;
    } else {
      // Direct exchange (won't work with Figma due to client_secret requirement)
      debugLog('Attempting direct token exchange (will likely fail)');
      
      const formData = new URLSearchParams();
      formData.append('client_id', clientId);
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code);
      formData.append('grant_type', 'authorization_code');
      // Note: client_secret is required but we can't include it in extensions

      debugLog('Sending token exchange request to:', FIGMA_TOKEN_URL);
      debugLog('Request body:', formData.toString());
      
      const response = await fetch(FIGMA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        debugLog('Token exchange failed with status:', response.status);
        debugLog('Error response:', errorText);
        
        if (errorText.includes('Client secret is required')) {
          throw new Error('Figma requires client secret. Please use external OAuth flow.');
        }
        
        throw new Error('Token exchange failed');
      }

      const data = await response.json();
      debugLog('Token exchange successful');
      return data.access_token;
    }
  } catch (error) {
    debugLog('Error exchanging code for token:', error);
    throw error;
  }
}

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener(() => {
  debugLog('Extension installed/updated');
  
  // Check if we have a stored access token
  chrome.storage.local.get(['figmaAccessToken'], function(result) {
    debugLog('Checking stored token:', result);
    if (result.figmaAccessToken) {
      accessToken = result.figmaAccessToken;
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
    return response.ok;
  } catch (error) {
    debugLog('Error verifying token:', error);
    return false;
  }
}

// Start OAuth flow
async function startOAuthFlow() {
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
    await chrome.storage.local.set({ 
      oauth_state: state
    });
    debugLog('Stored OAuth state');
    
    const redirectUri = getRedirectUrl();
    debugLog('Using redirect URI:', redirectUri);
    
    // Build OAuth URL (no PKCE since Figma requires client secret)
    const authUrl = `${FIGMA_OAUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
    
    debugLog('Opening OAuth URL:', authUrl);
    
    // If using external redirect, we need to set up polling for the response
    const USE_EXTERNAL_REDIRECT = true; // Should match getRedirectUrl()
    
    if (USE_EXTERNAL_REDIRECT) {
      debugLog('Setting up external OAuth polling');
      startExternalOAuthPolling(state);
    }
    
    // Open the OAuth URL in a new tab
    chrome.tabs.create({ url: authUrl });
  } catch (error) {
    debugLog('Error starting OAuth flow:', error);
    throw error;
  }
}

// Poll for external OAuth responses
let oauthPollingInterval = null;

function startExternalOAuthPolling(expectedState) {
  debugLog('Starting external OAuth polling for state:', expectedState);
  
  // Clear any existing polling
  if (oauthPollingInterval) {
    clearInterval(oauthPollingInterval);
  }
  
  // Poll for OAuth response in a content script
  oauthPollingInterval = setInterval(async () => {
    try {
      // Inject a content script to check localStorage on getfigtree.com
      const tabs = await chrome.tabs.query({ url: 'https://www.getfigtree.com/*' });
      
      for (const tab of tabs) {
        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const stored = localStorage.getItem('figtree_oauth_response');
              if (stored) {
                localStorage.removeItem('figtree_oauth_response');
                return JSON.parse(stored);
              }
              return null;
            }
          });
          
          if (result && result[0] && result[0].result) {
            const oauthResponse = result[0].result;
            debugLog('Found external OAuth response:', oauthResponse);
            
            if (oauthResponse.state === expectedState) {
              clearInterval(oauthPollingInterval);
              oauthPollingInterval = null;
              
              // Process the OAuth response
              await handleOAuthResponse(oauthResponse.code, oauthResponse.state);
              return;
            }
          }
        } catch (error) {
          // Ignore errors for individual tabs
          debugLog('Error checking tab for OAuth response:', error);
        }
      }
    } catch (error) {
      debugLog('Error during OAuth polling:', error);
    }
  }, 2000); // Poll every 2 seconds
  
  // Stop polling after 5 minutes
  setTimeout(() => {
    if (oauthPollingInterval) {
      clearInterval(oauthPollingInterval);
      oauthPollingInterval = null;
      debugLog('OAuth polling timeout');
    }
  }, 300000);
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
      accessToken = await getAccessToken();
    }
    
    if (!accessToken) {
      debugLog('No access token found, starting OAuth flow');
      await startOAuthFlow();
      return;
    }

    // Verify token is still valid
    const isValid = await verifyToken(accessToken);
    if (!isValid) {
      debugLog('Token is invalid, starting OAuth flow');
      accessToken = null;
      await chrome.storage.local.remove('figma_access_token');
      await startOAuthFlow();
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
    await startOAuthFlow();
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
    await chrome.storage.local.set({ figma_access_token: token });
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