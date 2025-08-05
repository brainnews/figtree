// Debug logging
function log(message, data = null) {
  console.log(`[Figtree OAuth] ${message}`, data || '');
  const debugEl = document.getElementById('debug');
  if (debugEl) {
    debugEl.innerHTML += `${new Date().toLocaleTimeString()}: ${message}<br>`;
  }
}

// Update UI elements
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

// Add close button for error states
function addCloseButton() {
  const container = document.querySelector('.container');
  if (container && !container.querySelector('button')) {
    const button = document.createElement('button');
    button.textContent = 'Close Window';
    button.onclick = () => window.close();
    container.appendChild(button);
  }
}

// Handle OAuth response with improved error handling and retries
function handleOAuthResponse() {
  log('OAuth handler starting');
  
  // Get the authorization code from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  // Check for OAuth errors first
  if (error) {
    log('OAuth error received', { error, errorDescription });
    updateUI(
      'Authorization Error',
      errorDescription || error,
      'Please close this window and try again.',
      true
    );
    setTimeout(addCloseButton, 1000);
    return;
  }

  if (!code || !state) {
    log('Missing OAuth parameters');
    updateUI(
      'Missing Parameters',
      'Authorization code or state parameter is missing.',
      'Please close this window and try again.',
      true
    );
    setTimeout(addCloseButton, 1000);
    return;
  }

  log('OAuth parameters received');
  log('Prepared message for extension');
  
  // Store OAuth response in localStorage for extension to poll
  const oauthResponse = {
    code: code,
    state: state,
    timestamp: Date.now()
  };

  try {
    // Store in localStorage
    localStorage.setItem('figtree_oauth_response', JSON.stringify(oauthResponse));
    log('Stored OAuth response in localStorage');
    
    // Log current localStorage contents for debugging
    log('localStorage contents:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('figtree_')) {
        log(`  ${key}: ${localStorage.getItem(key)}`);
      }
    }
    
    // Dispatch a custom event as fallback
    window.dispatchEvent(new CustomEvent('figtreeOAuthResponse', {
      detail: oauthResponse
    }));
    log('Dispatched custom event for extension');
    
    // Also store on window object as another fallback
    window.figtreeOAuthData = oauthResponse;
    log('OAuth response stored. Extension should be polling this tab for the response.');
    
    updateUI(
      'Authorization Successful!',
      'Response stored for extension pickup...',
      'Waiting for extension to process the response...'
    );
    
    // Add helpful debug information
    log('If the extension is not picking this up, check:');
    log('1. Extension has permission for getfigtree.com domain');
    log('2. Extension background script is running and polling');
    log('3. This tab URL matches the polling pattern');
    
    // Wait for extension to pick up the response (with timeout)
    let checkCount = 0;
    const maxChecks = 10; // 30 seconds total
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Check if OAuth response was consumed (removed from localStorage)
      const stored = localStorage.getItem('figtree_oauth_response');
      if (!stored) {
        clearInterval(checkInterval);
        log('OAuth response was consumed by extension');
        updateUI(
          'Success!',
          'Authorization completed successfully.',
          'You can now close this window.',
          false,
          true
        );
        setTimeout(addCloseButton, 1000);
        setTimeout(() => window.close(), 3000);
        return;
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        log('Timeout waiting for extension');
        updateUI(
          'Connection Timeout',
          'The extension did not pick up the authorization.',
          'Please close this window and try clicking the extension icon again.',
          true
        );
        setTimeout(addCloseButton, 1000);
      }
    }, 3000);
    
  } catch (error) {
    log('Error storing OAuth response:', error);
    updateUI(
      'Storage Error',
      'Failed to store the authorization response.',
      error.message,
      true
    );
    setTimeout(addCloseButton, 1000);
  }
}

// Execute the OAuth handling when the script loads
handleOAuthResponse(); 