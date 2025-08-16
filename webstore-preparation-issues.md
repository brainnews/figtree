# Chrome Web Store Preparation Issues

## Overview
This document outlines the issues that need to be addressed before submitting the Treekit Chrome Extension to the Chrome Web Store, based on the [official Chrome Web Store preparation guidelines](https://developer.chrome.com/docs/webstore/prepare).

## Current Status: ❌ Not Ready for Submission

The extension has a solid technical foundation but requires several content and documentation updates before it can be submitted to the Chrome Web Store.

## Critical Issues (Must Fix)

### 1. Privacy Policy Incomplete ❌
**File:** `extension/PRIVACY_POLICY.md`

**Issues:**
- Missing effective date: `[DATE]` placeholder not filled
- Missing last updated date: `[DATE]` placeholder not filled  
- Missing support email: `[SUPPORT_EMAIL]` placeholder not filled
- Missing GitHub repository link: `[USERNAME]` placeholder not filled

**Required Actions:**
- [ ] Fill in actual effective date (should be submission date)
- [ ] Fill in last updated date
- [ ] Add actual support email address
- [ ] Add correct GitHub repository URL
- [ ] Review content for accuracy with current implementation

### 2. Store Listing Materials Missing ❌
**Required for Web Store submission:**

**Screenshots:**
- [ ] Create 1280x800 or 640x400 pixel screenshots showing extension in use
- [ ] Show key features: project navigation, link copying, pinned items
- [ ] Include screenshots of OAuth flow and main UI panel

**Promotional Images:**
- [ ] Create 440x280 pixel promotional tile (required)
- [ ] Consider additional promotional images for better visibility

**Store Description:**
- [ ] Write detailed store description explaining value proposition
- [ ] Highlight key features and benefits
- [ ] Include clear instructions for first-time users
- [ ] Explain OAuth requirements and security

## Minor Issues (Recommended)

### 3. Version Strategy Consideration ⚠️
**File:** `extension/manifest.json` (line 4)

**Current:** `"version": "1.0.0"`

**Recommendation:**
- Consider starting with a lower version like `0.1.0` or `0.9.0` for initial submission
- Chrome Web Store recommends starting low and incrementing with each update
- Current version implies a mature, fully-featured release

### 4. Manifest Description Optimization ⚠️
**File:** `extension/manifest.json` (line 5)

**Current:** 110 characters (within 132 limit)
**Status:** ✅ Compliant but could be enhanced

**Current description:** "Quick access to your Figma projects. Navigate and copy links to files, pages, frames, and groups."

**Suggestions:**
- Consider adding benefits like "Save time" or "Boost productivity"
- Mention integration with Figma explicitly
- Emphasize the quick access aspect

## Technical Review Results ✅

### Manifest Requirements Status
- ✅ **Name:** "Treekit" - clear and appropriate
- ✅ **Version:** "1.0.0" - valid format
- ✅ **Description:** 110 chars - within 132 limit
- ✅ **Icons:** Complete set (16, 32, 48, 128px) - all present in `/icons/` directory

### File Structure Status
- ✅ **Manifest location:** Root directory (`extension/manifest.json`)
- ✅ **Required files:** All present (manifest, background, content scripts, icons)
- ✅ **File organization:** Clean structure with assets in subdirectories
- ✅ **Web accessible resources:** Properly configured for auth flow

### Permissions Review
- ✅ **Permissions justified:** All permissions have clear use cases
- ✅ **Host permissions:** Limited to necessary domains (Figma, Gettreekit)
- ✅ **Security:** OAuth2 configuration present, CSP properly configured

### Code Quality
- ✅ **Manifest v3:** Uses modern service worker architecture
- ✅ **Security:** Implements PKCE for OAuth, proper CSP
- ✅ **Error handling:** Includes debug logging and error management
- ✅ **Privacy:** No data collection beyond stated privacy policy

## OAuth Security Notes ℹ️

**Client ID Exposure:** The OAuth client ID (`qTujZ7BNoSdMdVikl3RaeD`) is visible in the manifest, which is standard and expected for Chrome extensions. The client secret is properly secured on the server side.

## Submission Preparation Checklist

### Before Packaging:
- [ ] Complete privacy policy with real dates and contact info
- [ ] Create required screenshots and promotional images
- [ ] Write comprehensive store description
- [ ] Test extension thoroughly with fresh Chrome profile
- [ ] Verify OAuth flow works in production environment

### Packaging for Submission:
- [ ] Create ZIP file of `extension/` directory contents
- [ ] Ensure manifest.json is in the root of the ZIP
- [ ] Verify all files are included and no unnecessary files
- [ ] Test the packaged extension by loading it in Chrome

### Store Listing Preparation:
- [ ] Prepare detailed description highlighting key features
- [ ] Upload screenshots showing core functionality
- [ ] Add promotional tile image
- [ ] Set appropriate category and tags
- [ ] Add support and website links

## Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Extension Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Web Store Publishing Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Extension Quality Guidelines](https://developer.chrome.com/docs/webstore/quality-guidelines/)

## Priority for Initial Submission

1. **Critical:** Fix privacy policy placeholders
2. **Critical:** Create required screenshots and promotional images  
3. **Critical:** Write store listing description
4. **Important:** Test packaging and submission process
5. **Optional:** Consider version number strategy
6. **Optional:** Optimize manifest description

---

**Next Steps:** Address critical issues first, then create marketing materials and test the complete submission package.