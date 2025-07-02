// Build configuration
const IS_PRODUCTION = false; // Set to true for production builds

// Development configuration
const DEV_CONFIG = {
  // For development, you can use a fixed extension ID
  // To get a fixed ID: go to chrome://extensions/, enable Developer mode,
  // click "Pack extension" to create a .crx file, then load that
  USE_FIXED_EXTENSION_ID: false,
  FIXED_EXTENSION_ID: 'your-fixed-extension-id-here',
  
  // Alternative: use external redirect for development
  USE_EXTERNAL_REDIRECT: true,
  EXTERNAL_REDIRECT_URL: 'https://www.getfigtree.com/oauth.html'
};

// Export configuration
window.IS_PRODUCTION = IS_PRODUCTION;
window.DEV_CONFIG = DEV_CONFIG; 