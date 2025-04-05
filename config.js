// Build configuration
const IS_PRODUCTION = true; // Set to true for production builds

// OAuth configuration
const OAUTH_REDIRECT_URL = IS_PRODUCTION
  ? 'https://getfigtree.com/oauth.html'
  : chrome.runtime.getURL('oauth.html');

// Export configuration
window.IS_PRODUCTION = IS_PRODUCTION;
window.OAUTH_REDIRECT_URL = OAUTH_REDIRECT_URL; 