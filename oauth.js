// Handle OAuth response
function handleOAuthResponse() {
  // Get the authorization code from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (!code || !state) {
    const errorUrl = window.IS_PRODUCTION
      ? 'https://getfigtree.com/error?reason=missing_params'
      : chrome.runtime.getURL('error.html?reason=missing_params');
    window.location.href = errorUrl;
    return;
  }

  // Send the code to the extension
  chrome.runtime.sendMessage({
    action: 'handleOAuthResponse',
    code: code,
    state: state
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending message:', chrome.runtime.lastError);
      const errorUrl = window.IS_PRODUCTION
        ? 'https://getfigtree.com/error?reason=message_failed'
        : chrome.runtime.getURL('error.html?reason=message_failed');
      window.location.href = errorUrl;
      return;
    }

    if (response && response.success) {
      const welcomeUrl = window.IS_PRODUCTION
        ? 'https://getfigtree.com/welcome'
        : chrome.runtime.getURL('welcome/index.html');
      window.location.href = welcomeUrl;
    } else {
      const reason = response?.error || 'unknown';
      const errorUrl = window.IS_PRODUCTION
        ? `https://getfigtree.com/error?reason=${encodeURIComponent(reason)}`
        : chrome.runtime.getURL(`error.html?reason=${encodeURIComponent(reason)}`);
      window.location.href = errorUrl;
    }
  });
}

// Execute the OAuth handling when the script loads
handleOAuthResponse(); 