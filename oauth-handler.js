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
  
  // Get the authorization code from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  log('OAuth parameters received', { 
    code: code ? 'present' : 'missing', 
    state: state ? 'present' : 'missing', 
    error 
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

  if (!code || !state) {
    log('Missing OAuth parameters');
    updateUI(
      'Missing Parameters',
      'Authorization code or state parameter is missing.',
      'Please close this window and try again.',
      true
    );
    return;
  }

  // Prepare message for extension
  const message = {
    type: 'FIGTREE_OAUTH_RESPONSE',
    code: code,
    state: state,
    source: 'external',
    timestamp: Date.now()
  };

  log('Prepared message for extension', { state, codeLength: code.length });

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