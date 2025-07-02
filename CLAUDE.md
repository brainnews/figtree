# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Figtree is a Chrome extension that provides quick access to Figma projects through a context menu interface. Users can copy direct links to any level of their Figma projects (project, page, frame, or group) with visual feedback and clipboard integration.

## Development Commands

### Testing the Extension
- Load unpacked extension from `chrome://extensions/` in developer mode
- Make changes to source files and click "Reload" on the extension card to test changes
- No build process required - all files are directly loaded by Chrome

### Key Files to Modify
- `manifest.json` - Extension configuration, permissions, and OAuth settings
- `background.js` - Service worker handling OAuth, API calls, and browser action
- `content.js` - UI creation, project management, and user interactions
- `config.js` - Build configuration (production/development flags)

## Architecture

### Core Components

**Chrome Extension Structure:**
- **Manifest V3** extension with service worker architecture
- **OAuth 2.0** integration with Figma API for secure authentication
- **Content script injection** for UI overlay on any webpage
- **Chrome storage** for persisting projects and user preferences

**Key Modules:**

1. **Background Service Worker (`background.js`)**
   - Manages Figma OAuth flow and token exchange
   - Handles extension icon clicks and context menu actions
   - Fetches project data from Figma API
   - Manages cross-tab communication for authorization state

2. **Content Script (`content.js`)**
   - Creates draggable floating UI panel with project hierarchy
   - Implements search functionality with real-time filtering
   - Manages pinned items system for quick access
   - Handles clipboard operations and visual feedback

3. **OAuth Handler (`oauth.html` + `oauth.js`)**
   - Processes OAuth callback from Figma
   - Exchanges authorization codes for access tokens
   - Redirects to welcome page after successful authentication

### Data Flow

1. **Authentication**: User clicks extension → OAuth flow → Token storage
2. **Project Loading**: Fetch user projects → Cache in chrome.storage.local
3. **UI Interaction**: User expands project → Lazy load pages/frames via Figma API
4. **Link Copying**: Click copy button → Generate Figma URL → Copy to clipboard
5. **Pinning System**: Pin/unpin items → Store in chrome.storage.sync

### API Integration

**Figma API Endpoints Used:**
- `GET /v1/me` - User authentication verification
- `GET /v1/files/{file_key}` - Project structure and metadata
- `GET /v1/files/{file_key}/nodes` - Specific node details (pages, frames, groups)
- `GET /v1/images/{file_key}` - Frame preview images
- `POST /v1/oauth/token` - OAuth token exchange

**Caching Strategy:**
- Project data cached in `nodeCache` Map for session duration
- Persistent storage in `chrome.storage.local` for projects list
- User preferences in `chrome.storage.sync` for cross-device sync

### Security Model

- OAuth 2.0 with PKCE for secure Figma API access
- Client credentials stored in manifest.json (public for extensions)
- Access tokens stored in Chrome's secure local storage
- HTTPS-only API communication with proper CORS handling
- Content Security Policy prevents XSS attacks

### UI Architecture

**Panel System:**
- Draggable floating panel with minimize/maximize controls
- Hierarchical tree view: Projects → Pages → Frames → Groups
- Search with real-time filtering and auto-expansion
- Pinned items section for quick access to favorites

**Styling Approach:**
- Inline CSS in content script to avoid external dependencies
- Dark theme with consistent color variables
- Material Icons for consistent iconography
- Responsive design for various screen sizes

## Development Notes

### Testing OAuth Flow
- Use `manifest-test.json` for development with test OAuth credentials
- Production OAuth requires proper client_id/client_secret in manifest.json
- Test with various Figma project types and permissions

### Content Script Injection
- UI injects into any webpage via `<all_urls>` permission
- Handles potential conflicts with existing page styles
- Cleanup on extension disable/uninstall

### Storage Management
- `chrome.storage.local`: Projects list, access tokens (per-device)
- `chrome.storage.sync`: Pinned items, user preferences (cross-device)
- Node cache cleared on session end to prevent memory leaks

### Error Handling
- Graceful degradation when Figma API is unavailable
- User feedback for authentication failures
- Retry mechanisms for network requests

## Common Development Patterns

### Adding New UI Features
1. Add HTML structure in `createFigtreeUI()` function
2. Add corresponding CSS in the inline style block
3. Implement event handlers after DOM creation
4. Update storage schema if persistent data needed

### Extending API Integration
1. Add new API endpoints in background.js
2. Implement caching strategy for new data types
3. Update content script to display new information
4. Handle loading states and error conditions

### Modifying Project Hierarchy
- Projects contain Pages contain Frames contain Groups
- Each level has consistent copy/pin/expand functionality
- Filter system searches all levels simultaneously
- Lazy loading prevents unnecessary API calls