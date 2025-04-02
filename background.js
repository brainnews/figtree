// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_OAUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
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
  const extensionId = chrome.runtime.id;
  //return `chrome-extension://${extensionId}/oauth.html`;
  return 'https://www.getfigtree.com/welcome'
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
  chrome.storage.local.get(['figmaAccessToken'], function(result) {
    debugLog('Checking stored token:', result);
    if (result.figmaAccessToken) {
      accessToken = result.figmaAccessToken;
      debugLog('Found stored token');
    }
  });
});

// Handle OAuth redirect
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.startsWith(getRedirectUrl())) {
    debugLog('OAuth redirect detected:', changeInfo.url);
    
    const url = new URL(changeInfo.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    // Verify state
    const { oauthState } = await chrome.storage.local.get('oauthState');
    if (state !== oauthState) {
      debugLog('State mismatch');
      return;
    }
    
    // Exchange code for token using the existing function
    try {
      const token = await exchangeCodeForToken(code);
      debugLog('Token exchange successful');
      
      // Store the access token
      await chrome.storage.local.set({ figmaAccessToken: token });
      
      // Get all tabs to find where we might have a panel open
      const tabs = await chrome.tabs.query({});
      
      // Close panels in all tabs except the OAuth tab
      for (const existingTab of tabs) {
        if (existingTab.id !== tabId) {
          try {
            // Check if we can inject scripts into this tab
            const canInject = existingTab.url && (
              existingTab.url.startsWith('http://') || 
              existingTab.url.startsWith('https://') ||
              existingTab.url.startsWith('file://')
            );
            
            if (canInject) {
              // Try to send a message to close any existing panels
              await chrome.tabs.sendMessage(existingTab.id, { action: 'closePanel' });
            }
          } catch (error) {
            // Ignore errors - tab might not have our content script
            debugLog('Tab does not have content script:', existingTab.id);
          }
        }
      }
      
      // Close the OAuth tab
      //chrome.tabs.remove(tabId);
      
      // Don't show the panel - just store the token
    } catch (error) {
      debugLog('Error exchanging code for token:', error);
    }
  }
});

// Get access token from storage
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['figmaAccessToken'], function(result) {
      debugLog('Retrieved token from storage:', result.figmaAccessToken ? 'exists' : 'not found');
      resolve(result.figmaAccessToken || null);
    });
  });
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
    chrome.storage.local.set({ oauthState: state }, () => {
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

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  debugLog('Extension icon clicked');
  
  // Show panel immediately
  await injectContentScript(tab);
  await sendMessageToContentScript(tab.id, { 
    action: 'showProjects',
    accessToken: null,
    projects: [] 
  });

  // Then fetch data asynchronously
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      debugLog('No access token found, starting OAuth flow');
      startOAuthFlow();
      return;
    }

    // Fetch projects in background
    fetchProjects(accessToken).then(async (projects) => {
      // Send updated data to content script
      await sendMessageToContentScript(tab.id, {
        action: 'updateProjects',
        accessToken,
        projects
      });
    }).catch(error => {
      debugLog('Error fetching projects:', error);
      if (error.message.includes('401')) {
        // Token expired or invalid, restart OAuth flow
        startOAuthFlow();
      }
    });

  } catch (error) {
    debugLog('Error:', error);
    if (error.message.includes('401')) {
      startOAuthFlow();
    }
  }
});

// Update sendMessageToContentScript to not wait for content script
async function sendMessageToContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    debugLog('Message sent successfully to content script:', message);
  } catch (error) {
    debugLog('Error sending message to content script:', error);
    throw error;
  }
}

// Inject content script more efficiently
async function injectContentScript(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    debugLog('Content script injected successfully');
  } catch (error) {
    debugLog('Error injecting content script:', error);
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