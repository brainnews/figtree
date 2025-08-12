# Figtree Local Testing Guide

This guide walks you through testing the new website-based OAuth authentication locally.

## Prerequisites

- Chrome browser with Developer Mode enabled
- Python 3 installed (for local server)
- Git repository cloned locally

## Local Testing Setup

### Step 1: Start Local Development Server

```bash
# Navigate to project directory
cd /Users/miles/Projects/figtree

# Start the development server
python3 dev-server.py

# Server will start at http://127.0.0.1:5500
```

The server will:
- Serve `website-auth.html` at the root
- Add proper CORS headers
- Provide mock API endpoints for testing

### Step 2: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `/Users/miles/Projects/figtree` directory
5. The Figtree extension should now appear in your extensions list

### Step 3: Test Basic Functionality

1. **Test Extension UI**:
   - Click the Figtree extension icon
   - Should see the authentication flow trigger
   - New tab should open to `http://127.0.0.1:5500/website-auth.html`

2. **Test Website Auth Page**:
   - Auth page should load with Figtree branding
   - "Connect to Figma" button should be visible
   - State parameter should be passed in URL

3. **Test OAuth Flow** (optional):
   - Click "Connect to Figma" 
   - Should redirect to Figma OAuth
   - Complete OAuth to test full flow

## Testing Scenarios

### Scenario 1: Extension Loading
- ✅ Extension loads without errors
- ✅ Extension icon appears in toolbar
- ✅ No console errors in background page

### Scenario 2: Auth Page Loading
- ✅ Auth page opens in new tab
- ✅ State parameter passed correctly
- ✅ UI renders properly

### Scenario 3: Communication Flow
- ✅ Extension polls for completion
- ✅ Script injection works
- ✅ Token retrieval mechanism functions

### Scenario 4: Error Handling
- ✅ Network errors handled gracefully
- ✅ Invalid state rejected
- ✅ Timeout after 5 minutes

## Debug Tools

### Chrome DevTools
1. **Extension Background Page**:
   - Go to `chrome://extensions/`
   - Click "Inspect views: background page" under Figtree
   - Check console for debug logs

2. **Website Auth Page**:
   - Open DevTools on auth page tab
   - Check console for auth flow logs
   - Inspect sessionStorage for token data

### Debug Commands
```javascript
// In extension background page console:
chrome.storage.local.get(['figma_access_token'], console.log);

// In website auth page console:
sessionStorage.getItem('figtree_auth_result');
```

## Common Issues & Solutions

### Issue: "ERR_CONNECTION_REFUSED"
**Solution**: Start the local development server with `python3 dev-server.py`

### Issue: Auth page won't load
**Solution**: Check that port 5500 is available and server is running

### Issue: CORS errors
**Solution**: The dev server includes CORS headers, but ensure you're using the server URL

### Issue: Extension doesn't detect auth completion
**Solution**: Check that script injection permissions are working in Chrome DevTools

## Production Testing

Once local testing passes:

1. Update `getWebsiteAuthUrl()` to use production URL
2. Deploy `website-auth.html` to `https://www.getfigtree.com/auth`
3. Test with real Figma OAuth flow
4. Verify token storage and all extension features

## File Structure

```
figtree/
├── background.js          # Extension background script
├── website-auth.html      # OAuth handler page
├── dev-server.py         # Local development server
├── test-auth.html        # Auth flow simulator
├── LOCAL_TESTING.md      # This guide
└── AUTH_FLOW.md          # Technical documentation
```

## Next Steps

After successful local testing:
1. Deploy to production environment
2. Update manifest for production builds
3. Test cross-browser compatibility
4. Monitor authentication success rates