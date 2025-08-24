# Figtree Extension - Permission Justifications

This document explains why each permission is necessary for the Figtree Chrome extension to function properly.

## Required Permissions

### `storage`
**Purpose**: Store user preferences, project data, and pinned items
**Justification**: 
- Saves the user's Figma project list locally to avoid repeated API calls
- Stores pinned items that sync across devices via Chrome sync storage
- Caches authentication tokens securely for seamless user experience
- Essential for the extension's core functionality of remembering user data

### `identity`
**Purpose**: Figma OAuth authentication
**Justification**:
- Required to authenticate users with their Figma accounts using OAuth 2.0
- Enables secure access to user's Figma projects without storing passwords
- Follows Figma's official API authentication requirements
- Cannot access Figma projects without proper authentication

### `clipboardWrite` 
**Purpose**: Copy Figma project links to clipboard
**Justification**:
- Core feature of the extension is copying direct links to Figma files, pages, frames, and groups
- Users click copy buttons to get shareable links for their design assets
- Essential for the extension's primary use case of quick link sharing
- No alternative method exists for programmatic clipboard access

### `activeTab`
**Purpose**: Inject floating panel UI on current webpage
**Justification**:
- Displays the draggable floating panel overlay on any webpage
- Allows users to access Figma projects without leaving their current page
- Limited to only the active tab for user privacy and security
- Core functionality requires UI injection into the current page

### `tabs`
**Purpose**: Manage extension state and OAuth flow
**Justification**:
- Opens OAuth authentication tabs for Figma login process
- Manages extension state across different browser tabs
- Required for the website-based OAuth flow that opens auth.html
- Does not access tab content, only manages tab creation/navigation

### `scripting`
**Purpose**: Inject content script for floating panel
**Justification**:
- Injects the content script that creates the floating panel interface
- Required for Manifest V3 architecture to dynamically load UI components
- Essential for displaying the extension's interface on webpages
- Limited to injecting the extension's own interface code

## Host Permissions

### `https://api.figma.com/*`
**Purpose**: Access Figma's REST API
**Justification**:
- Fetch user's Figma project data, file information, and thumbnails
- Required for all core functionality - cannot display projects without API access
- Official Figma API endpoint for accessing design files
- Essential for retrieving project hierarchies (pages, frames, groups)

### `https://www.gettreekit.com/*` and `https://gettreekit.com/*`
**Purpose**: OAuth authentication flow
**Justification**:
- Handles secure OAuth token exchange via external server
- Required for the website-based authentication flow
- Ensures client secrets are not exposed in the extension code
- Domain hosts the auth.html page for secure token handling

### `https://www.figma.com/*`
**Purpose**: OAuth redirects and authentication
**Justification**:
- Part of Figma's OAuth authentication flow
- May be required for OAuth redirects during authentication
- Ensures compatibility with Figma's authentication process

## Privacy and Security Notes

- **No broad web access**: Extension does not request `<all_urls>` or broad host permissions
- **Minimal data collection**: Only accesses user's own Figma projects they have permission to view
- **Secure authentication**: Uses OAuth 2.0 with proper token handling
- **Local storage only**: Project data stored locally on user's device, not transmitted elsewhere
- **No tracking**: Extension does not collect analytics or user behavior data

All permissions are essential for the extension's stated purpose of providing quick access to Figma projects through a floating panel interface.