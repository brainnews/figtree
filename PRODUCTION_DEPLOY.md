# 🌐 Figtree Production Deployment Guide

This guide covers deploying the website-based OAuth authentication to production.

## Prerequisites

- Domain: `getfigtree.com` (or your chosen domain)
- HTTPS hosting (required for OAuth)
- Access to upload files to web server

## Deployment Steps

### 1. Upload Website Auth Page

Upload `website-auth.html` to your web server at:
```
https://www.getfigtree.com/auth
```

The file should be accessible at this exact URL since the extension is configured to use it.

### 2. Verify OAuth Configuration

Ensure `website-auth.html` has the correct settings:

```javascript
// In website-auth.html, verify:
const FIGMA_CLIENT_ID = 'qTujZ7BNoSdMdVikl3RaeD';
const REDIRECT_URI = window.location.origin + window.location.pathname;
```

### 3. Test Production URLs

Verify these URLs work:
- ✅ `https://www.getfigtree.com/auth` - Loads auth page
- ✅ HTTPS certificate is valid
- ✅ No CORS or security issues

### 4. Update Extension for Production

The extension automatically detects production vs development. No code changes needed!

Production detection works by checking for `update_url` in manifest:
```javascript
const isDevelopment = !('update_url' in chrome.runtime.getManifest());
```

### 5. Create Production Build

For Chrome Web Store deployment:

1. **Update manifest.json** (if needed):
   ```json
   {
     "update_url": "https://clients2.google.com/service/update2/crx",
     // ... rest of manifest
   }
   ```

2. **Remove development files**:
   ```bash
   # Remove these from production build:
   rm dev-server.py
   rm test-auth.html
   rm test-setup.js
   rm LOCAL_TESTING.md
   rm PRODUCTION_DEPLOY.md
   ```

3. **Create ZIP for Chrome Web Store**:
   ```bash
   zip -r figtree-extension.zip . -x "*.md" "*.py" "test-*" "node_modules/*"
   ```

## Testing Production

### Manual Testing
1. Load extension from production build
2. Click extension icon
3. Should open `https://www.getfigtree.com/auth`
4. Complete Figma OAuth flow
5. Verify extension receives token and functions normally

### Automated Testing
```javascript
// Test script for production environment
fetch('https://www.getfigtree.com/auth')
  .then(response => response.text())
  .then(html => {
    console.log('✅ Auth page loads');
    console.log('Contains OAuth logic:', html.includes('figma.com/oauth'));
  })
  .catch(error => console.error('❌ Auth page failed to load:', error));
```

## Security Considerations

### HTTPS Required
- Figma OAuth requires HTTPS for redirect URIs
- Ensure SSL certificate is valid and up-to-date

### Content Security Policy
Verify your web server allows:
- JavaScript execution
- Redirects to `figma.com`
- SessionStorage access

### Rate Limiting
Consider adding rate limiting to prevent abuse:
- Limit auth attempts per IP
- Monitor for suspicious patterns

## Monitoring

### Success Metrics
- OAuth completion rate
- Extension authentication success
- User feedback and error reports

### Error Tracking
Monitor for:
- Failed OAuth redirects
- Token exchange errors
- Extension communication failures

## Rollback Plan

If issues occur:

1. **Quick fix**: Revert `website-auth.html` to previous version
2. **Extension update**: Push new extension version if needed
3. **Fallback**: Temporarily use extension-local auth (if configured)

## Domain Configuration

### DNS Settings
Ensure these records exist:
```
A    www.getfigtree.com  -> [your-server-ip]
AAAA www.getfigtree.com  -> [your-server-ipv6]
```

### SSL Certificate
Verify HTTPS works:
```bash
curl -I https://www.getfigtree.com/auth
```

Should return `200 OK` with valid SSL.

## Chrome Web Store

### Submission Checklist
- [ ] Extension functions correctly in production
- [ ] OAuth flow completes successfully
- [ ] Privacy policy updated to reflect OAuth usage
- [ ] Screenshots and description updated
- [ ] All test scenarios pass

### Review Process
- Chrome may take 1-7 days to review
- Ensure OAuth permissions are clearly explained
- Provide detailed testing instructions

## Support & Maintenance

### User Issues
Common support scenarios:
- "Extension won't connect" → Check auth page accessibility
- "OAuth fails" → Verify Figma client ID and redirect URI
- "Token expired" → Extension should handle re-authentication

### Updates
For future updates:
- Test in development environment first
- Deploy website changes before extension updates
- Monitor error rates after deployment

## File Structure (Production)

```
Extension Package:
├── manifest.json
├── background.js
├── content.js
├── config.js
├── oauth.html (legacy, can remove)
├── assets/
└── icons/

Website Deployment:
└── website-auth.html → https://www.getfigtree.com/auth
```

This production setup provides a reliable, scalable authentication system for your Figtree Chrome extension.