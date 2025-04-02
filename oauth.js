// Handle OAuth response
function handleOAuthResponse() {
  // Get the authorization code from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (!code || !state) {
    window.location.href = 'https://www.getfigtree.com/error?reason=missing_params';
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
      window.location.href = 'https://www.getfigtree.com/error?reason=message_failed';
      return;
    }

    if (response && response.success) {
      window.location.href = 'https://www.getfigtree.com/welcome';
    } else {
      const reason = response?.error || 'unknown';
      window.location.href = `https://www.getfigtree.com/error?reason=${encodeURIComponent(reason)}`;
    }
  });
}

// Execute the OAuth handling when the script loads
handleOAuthResponse(); 