# Figtree Website-Based Authentication Flow

This document describes the new website-based OAuth authentication system for the Figtree Chrome extension.

## Problem with Previous Approach

The previous OAuth implementation had several issues:
- Extension ID changes between installations, breaking redirect URIs
- Complex polling mechanisms prone to race conditions
- Client secret couldn't be securely stored in extensions
- Chrome identity API limitations and compatibility issues

## New Website-Based Solution

### Overview
Instead of handling OAuth directly in the extension, we now use a dedicated website page that manages the entire OAuth flow and communicates the results back to the extension.

### Flow Steps

1. **Extension Triggers Auth**
   - User clicks extension icon
   - Extension detects no/invalid token
   - Extension generates unique state parameter
   - Extension opens `website-auth.html?extension_state={state}`

2. **Website Handles OAuth**
   - Website page loads with extension state
   - User clicks "Connect to Figma"
   - Website generates its own OAuth state
   - Website redirects to Figma OAuth with implicit flow
   - Figma redirects back to website with access token

3. **Token Bridge**
   - Website receives token from Figma
   - Website validates state parameters
   - Website stores token in sessionStorage as JSON
   - Website shows success message

4. **Extension Retrieves Token**
   - Extension polls the website tab every 2 seconds
   - Extension injects script to check sessionStorage
   - When token found, extension retrieves and stores it
   - Extension closes the auth tab
   - Extension continues with normal operation

### Key Files

- **`website-auth.html`** - Standalone OAuth handler page
- **`background.js`** - Updated extension background script
- **`manifest.json`** - Updated to include website-auth.html as web accessible resource

### Benefits

✅ **Reliability** - No extension ID dependencies  
✅ **Security** - Proper OAuth state validation  
✅ **Simplicity** - Clean separation of concerns  
✅ **Cross-browser** - Same flow works everywhere  
✅ **Debugging** - Easy to test and troubleshoot  

### Testing

1. Load the extension in Chrome developer mode
2. Click the extension icon
3. Website auth page should open automatically
4. Complete Figma OAuth flow
5. Extension should automatically detect completion and proceed

### Production Deployment

For production, update `getWebsiteAuthUrl()` in `background.js` to use:
```javascript
const websiteAuthUrl = 'https://www.getfigtree.com/auth';
```

And host the `website-auth.html` file at that URL.

### Token Storage

Tokens are stored in `chrome.storage.local` with key `figma_access_token` and remain compatible with all existing extension functionality.

## Migration Notes

- All existing features (projects, pinning, search, etc.) work unchanged
- Users will need to re-authenticate once with the new system
- Old OAuth code removed to reduce complexity
- Polling timeout set to 5 minutes for reliability