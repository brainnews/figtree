// Debug logging
function log(message, data = null) {
  console.log(`[Figtree OAuth Local] ${message}`, data || '');
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

// Handle OAuth response from extension-local page
function handleLocalOAuthResponse() {
  log('Extension-local OAuth handler starting');
  
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

  log('Valid OAuth parameters received');
  updateUI(
    'Authorization Successful!',
    'Processing authorization...',
    'Communicating with extension background...'
  );

  // Send message directly to background script (this works for extension-local pages)
  try {
    log('Sending message to background script');
    chrome.runtime.sendMessage({
      action: 'handleOAuthResponse',
      code: code,
      state: state
    }, (response) => {
      if (chrome.runtime.lastError) {
        log('Chrome runtime error:', chrome.runtime.lastError.message);
        updateUI(
          'Communication Error',
          'Failed to communicate with extension background.',
          chrome.runtime.lastError.message,
          true
        );
        setTimeout(addCloseButton, 1000);
        return;
      }

      if (response && response.success) {
        log('OAuth response processed successfully');
        updateUI(
          'Success!',
          'Authorization completed successfully.',
          'You can now close this window.',
          false,
          true
        );
        setTimeout(addCloseButton, 1000);
        
        // Auto-close after delay
        setTimeout(() => {
          window.close();
        }, 3000);
      } else {
        log('OAuth response processing failed', response);
        const reason = response?.error || 'processing_failed';
        updateUI(
          'Processing Error',
          'Failed to process the authorization.',
          `Error: ${reason}`,
          true
        );
        setTimeout(addCloseButton, 1000);
      }
    });
  } catch (error) {
    log('Error sending message to background:', error);
    updateUI(
      'Script Error',
      'An error occurred while processing the authorization.',
      error.message,
      true
    );
    setTimeout(addCloseButton, 1000);
  }
}

// Execute when page loads
document.addEventListener('DOMContentLoaded', handleLocalOAuthResponse);