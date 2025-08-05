// External OAuth handler script
// This file should be hosted alongside oauth.html

// Debug logging
function log(message, data = null) {
  console.log(`[Figtree OAuth] ${message}`, data || '');
  const debugEl = document.getElementById('debug');
  if (debugEl) {
    debugEl.innerHTML += `${new Date().toLocaleTimeString()}: ${message}<br>`;
  }
}

// Update UI
function updateUI(title, message, status, isError = false, isSuccess = false) {
  const titleEl = document.getElementById('title');
  const messageEl = document.getElementById('message');
  const statusEl = document.getElementById('status');
  const spinnerEl = document.getElementById('spinner');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = `status ${isError ? 'error' : isSuccess ? 'success' : ''}`;
  }
  
  if ((isError || isSuccess) && spinnerEl) {
    spinnerEl.style.display = 'none';
  }
}

// Add close button
function addCloseButton() {
  const container = document.querySelector('.container');
  if (container && !container.querySelector('button')) {
    const button = document.createElement('button');
    button.textContent = 'Close Window';
    button.onclick = () => window.close();
    container.appendChild(button);
  }
}

// Handle OAuth response from external URL
async function handleExternalOAuthResponse() {
  log('External OAuth handler loaded');
  
  // Get OAuth response from URL (check both query params and hash for different flow types)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  
  // Authorization code flow (query params)
  let code = urlParams.get('code');
  let state = urlParams.get('state') || hashParams.get('state');
  const error = urlParams.get('error') || hashParams.get('error');
  const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
  
  // Implicit flow (hash params)
  let accessToken = hashParams.get('access_token');
  const tokenType = hashParams.get('token_type');
  
  // Handle Figma's custom OAuth response format in hash
  // Format: #figu_<token>:<state>
  const hash = window.location.hash.substring(1);
  if (hash.startsWith('figu_') && hash.includes(':')) {
    log('Detected Figma custom OAuth format');
    const parts = hash.split(':');
    if (parts.length >= 2) {
      accessToken = parts[0]; // The full figu_... token
      state = parts[1]; // The state after the colon
      log('Parsed Figma OAuth response', { 
        tokenPrefix: accessToken.substring(0, 10) + '...', 
        state: state 
      });
    }
  }

  log('OAuth parameters received', { 
    code: code ? 'present' : 'missing',
    accessToken: accessToken ? 'present' : 'missing',
    state: state ? 'present' : 'missing', 
    error,
    fullUrl: window.location.href,
    hash: window.location.hash,
    search: window.location.search
  });

  if (error) {
    log('OAuth error received', { error, errorDescription });
    updateUI(
      'Authorization Error',
      errorDescription || error,
      'Please close this window and try again.',
      true
    );
    
    // Show close button after error
    setTimeout(addCloseButton, 1000);
    return;
  }

  if ((!code && !accessToken) || !state) {
    log('Missing OAuth parameters - debugging info:', {
      hasCode: !!code,
      hasToken: !!accessToken, 
      hasState: !!state,
      codeValue: code,
      tokenValue: accessToken,
      stateValue: state,
      hashParams: Object.fromEntries(hashParams),
      urlParams: Object.fromEntries(urlParams)
    });
    updateUI(
      'Missing Parameters',
      'Authorization code/token or state parameter is missing.',
      'Please close this window and try again.',
      true
    );
    return;
  }

  // Prepare message for extension
  const message = {
    type: 'FIGTREE_OAUTH_RESPONSE',
    code: code,
    access_token: accessToken,
    state: state,
    source: 'external',
    timestamp: Date.now()
  };

  log('Prepared message for extension', { 
    state, 
    hasCode: !!code,
    hasToken: !!accessToken,
    codeLength: code ? code.length : 0 
  });

  // Method 1: Store in localStorage for extension polling
  try {
    localStorage.setItem('figtree_oauth_response', JSON.stringify(message));
    log('Stored OAuth response in localStorage');
    log('localStorage contents:', localStorage.getItem('figtree_oauth_response'));
    updateUI(
      'Authorization Successful!',
      'Connecting to extension...',
      'Waiting for extension to receive the authorization...'
    );
  } catch (e) {
    log('Failed to store in localStorage', e);
    updateUI(
      'Storage Error',
      'Failed to store authorization data.',
      'Please close this window and try again.',
      true
    );
    return;
  }

  // Method 2: Try postMessage to opener (if opened from extension)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(message, '*');
      log('Sent postMessage to opener window');
    } catch (e) {
      log('Failed to send postMessage to opener', e);
    }
  }

  // Method 3: Try broadcasting to extension via custom event
  try {
    window.dispatchEvent(new CustomEvent('figtree-oauth-response', {
      detail: message
    }));
    log('Dispatched custom event for extension');
  } catch (e) {
    log('Failed to dispatch custom event', e);
  }

  // Method 4: Manual notification for debugging
  log('OAuth response stored. Extension should be polling this tab for the response.');
  log('If the extension is not picking this up, check:');
  log('1. Extension has permission for getfigtree.com domain');
  log('2. Extension background script is running and polling');
  log('3. This tab URL matches the polling pattern');

  // Check if extension picked up the response
  let checkCount = 0;
  const maxChecks = 30; // 30 seconds
  
  const checkInterval = setInterval(() => {
    checkCount++;
    
    try {
      const stored = localStorage.getItem('figtree_oauth_response');
      if (!stored) {
        // Extension consumed the response
        log('Extension picked up OAuth response');
        clearInterval(checkInterval);
        updateUI(
          'Success!',
          'Authorization completed successfully.',
          'You can now close this window and return to the extension.',
          false,
          true
        );
        
        // Show close button
        setTimeout(addCloseButton, 1000);

        // Auto-close after delay
        setTimeout(() => {
          window.close();
        }, 5000);
        return;
      }
    } catch (e) {
      log('Error checking localStorage', e);
    }
    
    // Update status
    updateUI(
      'Authorization Successful!',
      'Waiting for extension to connect...',
      `Attempting connection... (${checkCount}/${maxChecks})`
    );
    
    // Timeout after 30 seconds
    if (checkCount >= maxChecks) {
      clearInterval(checkInterval);
      log('Timeout waiting for extension');
      updateUI(
        'Connection Timeout',
        'The extension did not pick up the authorization.',
        'Please close this window and try clicking the extension icon again.',
        true
      );
      
      // Show close button
      setTimeout(addCloseButton, 1000);
    }
  }, 1000);
}

// Execute when page loads
document.addEventListener('DOMContentLoaded', handleExternalOAuthResponse);