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
  
  // Use external redirect for production compatibility
  // Extension-local redirect won't work because each user has different extension ID
  const redirectUrl = 'https://www.getfigtree.com/oauth.html';
  debugLog('Using external redirect URL for production:', redirectUrl);
  
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
    
    const response = await fetch('https://www.getfigtree.com/server/api/oauth/token', {
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
    
    // Build OAuth URL using implicit flow (response_type=implicit) to avoid client_secret requirement
    const authUrl = `${FIGMA_OAUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=implicit&state=${state}`;
    
    debugLog('Opening OAuth URL:', authUrl);
    
    // Open the OAuth URL in a new tab and set up polling for external redirect
    const oauthTab = await chrome.tabs.create({ url: authUrl });
    debugLog('Created OAuth tab:', oauthTab.id);
    
    // Start improved polling mechanism
    startImprovedOAuthPolling(state, oauthTab.id);
  } catch (error) {
    debugLog('Error starting OAuth flow:', error);
    throw error;
  }
}

// Improved OAuth polling for external redirect
let oauthPollingInterval = null;
let oauthTabListener = null;

function startImprovedOAuthPolling(expectedState, oauthTabId) {
  debugLog('Starting improved OAuth polling for state:', expectedState);
  debugLog('Tracking OAuth tab ID:', oauthTabId);
  
  // Clear any existing polling
  if (oauthPollingInterval) {
    clearInterval(oauthPollingInterval);
    oauthPollingInterval = null;
  }

  // Remove any existing tab listener
  if (oauthTabListener) {
    chrome.tabs.onUpdated.removeListener(oauthTabListener);
    oauthTabListener = null;
  }

  // Listen for tab updates to detect successful OAuth redirect
  oauthTabListener = (tabId, changeInfo, tab) => {
    if (tabId === oauthTabId && changeInfo.url) {
      debugLog('OAuth tab URL changed to:', changeInfo.url);
      
      // Check if we've reached the OAuth callback page
      if (changeInfo.url.includes('getfigtree.com/oauth.html') && (changeInfo.url.includes('access_token=') || changeInfo.url.includes('code='))) {
        debugLog('OAuth redirect detected, extracting token from URL');
        
        try {
          const url = new URL(changeInfo.url);
          
          // Check for implicit flow token in hash
          let accessToken = null;
          let state = null;
          let error = null;
          
          if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            accessToken = hashParams.get('access_token');
            state = hashParams.get('state');
            error = hashParams.get('error');
          }
          
          // Fallback to query params for authorization code flow
          if (!accessToken) {
            const code = url.searchParams.get('code');
            state = url.searchParams.get('state');
            error = url.searchParams.get('error');
            
            if (code && state && state === expectedState) {
              debugLog('Authorization code found, exchanging for token...');
              cleanupPolling();
              handleOAuthResponse(code, state);
              return;
            }
          }
          
          if (error) {
            debugLog('OAuth error in URL:', error);
            cleanupPolling();
            return;
          }
          
          if (accessToken && state && state === expectedState) {
            debugLog('Access token found in URL, processing...');
            cleanupPolling();
            handleDirectTokenResponse(accessToken, state);
          } else {
            debugLog('Invalid OAuth response in URL:', { hasToken: !!accessToken, state, expectedState });
          }
        } catch (error) {
          debugLog('Error parsing OAuth URL:', error);
        }
      }
    }
  };
  
  chrome.tabs.onUpdated.addListener(oauthTabListener);
  
  // Fallback: Poll for content script injection method
  debugLog('Setting up polling interval every 3 seconds');
  oauthPollingInterval = setInterval(async () => {
    try {
      debugLog(`Polling attempt for tab ${oauthTabId}...`);
      await checkTabForOAuthResponse(oauthTabId, expectedState);
    } catch (error) {
      debugLog('Error during OAuth polling:', error);
    }
  }, 3000); // Poll every 3 seconds
  
  // Stop polling after 5 minutes
  setTimeout(() => {
    if (oauthPollingInterval || oauthTabListener) {
      debugLog('OAuth polling timeout - stopped after 5 minutes');
      cleanupPolling();
    }
  }, 300000);
}

// Helper function to check tab for OAuth response using content script
async function checkTabForOAuthResponse(tabId, expectedState) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      debugLog(`Tab ${tabId} no longer exists`);
      return;
    }
    
    if (!tab.url) {
      debugLog(`Tab ${tabId} has no URL`);
      return;
    }
    
    debugLog(`Checking tab ${tabId} with URL: ${tab.url}`);
    
    if (!tab.url.includes('getfigtree.com')) {
      debugLog(`Tab ${tabId} URL does not contain getfigtree.com, skipping`);
      return;
    }
    
    debugLog(`Injecting script into tab ${tabId} for OAuth response check`);
    
    // Try to inject a content script to check for OAuth response
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
        try {
          console.log('[Figtree OAuth Check] Script injected, checking for OAuth response...');
          
          // Method 1: Check localStorage
          const stored = localStorage.getItem('figtree_oauth_response');
          console.log('[Figtree OAuth Check] localStorage check:', stored ? 'found' : 'not found');
          if (stored) {
            const response = JSON.parse(stored);
            console.log('[Figtree OAuth Check] Parsed localStorage response:', response);
            // Clear the stored response so it's consumed
            localStorage.removeItem('figtree_oauth_response');
            console.log('[Figtree OAuth Check] Removed localStorage entry');
            return { method: 'localStorage', response };
          }
          
          // Method 2: Check URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const state = urlParams.get('state');
          const error = urlParams.get('error');
          
          console.log('[Figtree OAuth Check] URL params check:', { hasCode: !!code, hasState: !!state, error });
          
          if (code && state) {
            return { 
              method: 'urlParams', 
              response: { code, state, error }
            };
          }
          
          // Method 3: Check for custom events
          const customData = window.figtreeOAuthData;
          console.log('[Figtree OAuth Check] Custom data check:', customData ? 'found' : 'not found');
          if (customData) {
            window.figtreeOAuthData = null;
            return { method: 'customData', response: customData };
          }
          
          console.log('[Figtree OAuth Check] No OAuth response found');
          return null;
        } catch (e) {
          console.error('[OAuth Check] Error:', e);
          return { error: e.message };
        }
      }
    });
    } catch (scriptError) {
      debugLog(`Script injection failed for tab ${tabId}:`, scriptError.message);
      return;
    }
    
    debugLog(`Script injection result for tab ${tabId}:`, results);
    
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      
      if (result.error) {
        debugLog('Error in content script:', result.error);
        return;
      }
      
      if (result.response) {
        const { code, access_token, state, error } = result.response;
        debugLog(`Found OAuth response via ${result.method}:`, { 
          hasCode: !!code, 
          hasToken: !!access_token, 
          state, 
          error 
        });
        
        if (error) {
          debugLog('OAuth error received:', error);
          cleanupPolling();
          return;
        }
        
        // Handle implicit flow (access_token) or authorization code flow (code)
        if (access_token && state && state === expectedState) {
          debugLog('Valid access token found, processing...');
          cleanupPolling();
          await handleDirectTokenResponse(access_token, state);
        } else if (code && state && state === expectedState) {
          debugLog('Valid authorization code found, processing...');
          cleanupPolling();
          await handleOAuthResponse(code, state);
        } else {
          debugLog('Invalid OAuth response:', { 
            hasCode: !!code, 
            hasToken: !!access_token,
            hasState: !!state, 
            stateMatch: state === expectedState 
          });
        }
      }
    }
  } catch (error) {
    debugLog('Error checking tab for OAuth response:', error.message);
  }
}

// Clean up polling resources
function cleanupPolling() {
  if (oauthPollingInterval) {
    clearInterval(oauthPollingInterval);
    oauthPollingInterval = null;
  }
  
  if (oauthTabListener) {
    chrome.tabs.onUpdated.removeListener(oauthTabListener);
    oauthTabListener = null;
  }
  
  debugLog('OAuth polling cleanup completed');
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
    await chrome.storage.local.set({ figma_access_token: token });
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