// Handle OAuth response
function handleOAuthResponse() {
  // Get the authorization code from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (!code || !state) {
    window.location.href = window.IS_PRODUCTION
      ? 'https://getfigtree.com/error?reason=missing_params'
      : chrome.runtime.getURL('error.html?reason=missing_params');
    return;
  }

  if (window.IS_PRODUCTION) {
    // In production, redirect to the welcome page with the code and state as query params
    window.location.href = `https://getfigtree.com/welcome?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    return;
  }

  // In development (extension context), send message to background script
  chrome.runtime.sendMessage({
    action: 'handleOAuthResponse',
    code: code,
    state: state
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
      window.location.href = chrome.runtime.getURL('error.html?reason=message_failed');
      return;
    }

    if (response && response.success) {
      window.location.href = chrome.runtime.getURL('welcome/index.html');
    } else {
      const reason = response?.error || 'unknown';
      window.location.href = chrome.runtime.getURL(`error.html?reason=${encodeURIComponent(reason)}`);
    }
  });
}

// Execute the OAuth handling when the script loads
handleOAuthResponse(); 