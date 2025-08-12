# 🚀 Figtree Local Testing - Quick Start

## Ready to Test! ✅

Your website-based OAuth authentication system is ready for local testing. Here's how to test it:

## 1. Start Local Server (Already Running)

The local server is already running at `http://127.0.0.1:8080`

If you need to restart it:
```bash
# Stop current server (if running)
pkill -f "python3 -m http.server"

# Start new server
python3 -m http.server 8080
```

## 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top right)
3. Click "Load unpacked"
4. Select this directory: `/Users/miles/Projects/figtree`
5. The Figtree extension should appear in your extensions list

## 3. Test the Auth Flow

1. **Click the Figtree extension icon** in Chrome toolbar
2. **New tab should open** to: `http://127.0.0.1:8080/website-auth.html`
3. **Auth page should load** with "Connect to Figma" button
4. **Extension should poll** for completion (check console logs)

## 4. Test Website Auth Page

1. **Visit directly**: `http://127.0.0.1:8080/website-auth.html`
2. **Should see**: Clean UI with Figtree branding
3. **Click "Connect to Figma"**: Should redirect to Figma OAuth
4. **Complete OAuth**: To test full flow end-to-end

## 5. Debug with Chrome DevTools

### Extension Background Console:
1. Go to `chrome://extensions/`
2. Find Figtree extension
3. Click "Inspect views: background page"
4. Check console for logs like:
   ```
   [Figtree] Starting website-based OAuth flow
   [Figtree] Using development auth URL: http://127.0.0.1:8080/website-auth.html
   ```

### Website Auth Page Console:
1. Open DevTools on the auth page tab
2. Check console for OAuth flow logs
3. Check sessionStorage: `sessionStorage.getItem('figtree_auth_result')`

## 🎯 What Should Work

- ✅ Extension loads without errors
- ✅ Auth page opens in new tab
- ✅ State parameter passed correctly
- ✅ Website auth page renders properly
- ✅ Extension polls for completion
- ✅ Script injection works for token retrieval

## 🔍 Troubleshooting

### "Site can't be reached" error
- Make sure server is running: `python3 -m http.server 8080`
- Check URL is `http://127.0.0.1:8080/website-auth.html`

### Extension doesn't load
- Ensure Developer mode is enabled
- Check for errors in Chrome extensions page
- Verify all files are present in directory

### Auth page doesn't open
- Check extension background console for errors
- Verify `getWebsiteAuthUrl()` returns correct URL

## 🚀 Next Steps

After local testing works:

1. **Test with real Figma OAuth** (complete flow)
2. **Verify token storage** works correctly
3. **Test all extension features** with authenticated state
4. **Deploy to production** when ready

## 📁 Current Configuration

- **Local Server**: `http://127.0.0.1:8080`
- **Auth Page**: `http://127.0.0.1:8080/website-auth.html`
- **Extension Mode**: Development (auto-detected)
- **Production URL**: `https://www.getfigtree.com/auth` (for later)

The system automatically detects development vs production environment and uses appropriate URLs.