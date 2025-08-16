# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Figtree is a Chrome extension that provides quick access to Figma projects through a floating UI panel. Users can copy direct links to any level of their Figma projects (project, page, frame, or group) with visual feedback and clipboard integration. The extension uses a website-based OAuth flow with external server infrastructure for secure token exchange.

## Development Commands

### Local Development
- `npm run dev` - Start local development server (Python 3) on port 5500
- `npm run dev:alt` - Alternative server using Python's http.server
- `npm run test` - Shows testing instructions (load extension in Chrome)
- `npm run build` - Production preparation reminder

### Extension Testing
1. Start local server: `npm run dev` or `python3 dev-server.py`
2. Load unpacked extension from `chrome://extensions/` in developer mode
3. Make changes to source files and click "Reload" on the extension card
4. Test OAuth flow using `auth.html` served locally

### Key Files to Modify
- `extension/manifest.json` - Extension configuration, permissions, and OAuth settings
- `extension/background.js` - Service worker handling OAuth, API calls, and browser action
- `extension/content.js` - UI creation, project management, and user interactions
- `auth.html` - OAuth authentication handler page
- `extension/config.js` - Development/production configuration flags

## Architecture

### Core Components

**Chrome Extension Structure:**
- **Manifest V3** extension with service worker architecture
- **Website-based OAuth** with external server infrastructure for secure token exchange
- **Content script injection** for UI overlay on any webpage
- **Chrome storage** for persisting projects and user preferences

**Key Modules:**

1. **Background Service Worker (`extension/background.js`)**
   - Manages website-based OAuth flow by opening `auth.html`
   - Handles extension icon clicks and browser action
   - Fetches project data from Figma API with stored access tokens
   - Polls for OAuth completion via script injection

2. **Content Script (`extension/content.js`)**
   - Creates draggable floating UI panel with project hierarchy
   - Implements search functionality with real-time filtering
   - Manages pinned items system for quick access
   - Handles clipboard operations and visual feedback

3. **Website OAuth Handler (`auth.html`)**
   - Standalone OAuth page served from `gettreekit.com` or local server
   - Handles Figma OAuth authorization code flow
   - Exchanges codes for tokens via external server (`/api/oauth/token`)
   - Stores access tokens in sessionStorage for extension retrieval

4. **Server Infrastructure**:
   - **Cloudflare Worker** (`cloudflare-worker/worker.js`) - Edge computing solution for token exchange

### Data Flow

1. **Authentication**: User clicks extension → Opens `auth.html` → Figma OAuth → External token exchange → Token stored in sessionStorage → Extension retrieves token
2. **Project Loading**: Fetch user projects → Cache in chrome.storage.local
3. **UI Interaction**: User expands project → Lazy load pages/frames via Figma API
4. **Link Copying**: Click copy button → Generate Figma URL → Copy to clipboard
5. **Pinning System**: Pin/unpin items → Store in chrome.storage.sync

### OAuth Flow Architecture

```
Extension → auth.html → Figma OAuth → Cloudflare Worker → Access Token
    ↓              ↓                  ↓               ↓               ↓
  Opens tab    Authorization      Server exchange     Token         Extension
              code received      (Cloudflare)        stored        retrieval
```

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

### OAuth System Configuration
- **Production**: Uses `https://www.gettreekit.com/auth.html`
- **Server deployment**: Cloudflare Workers (`cloudflare-worker/`)

### Server Infrastructure
- **Cloudflare Deployment**: `cd cloudflare-worker && wrangler deploy`
- **Environment Variable**: `FIGMA_CLIENT_SECRET` must be set in Cloudflare dashboard
- **Token Exchange**: Cloudflare Worker handles client secret securely

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

## Deployment Architecture

### Components
- **Chrome Extension**: Distributed via Chrome Web Store or developer mode
- **Website Auth Page**: Hosted on `gettreekit.com` (GitHub Pages + Cloudflare)
- **OAuth Server**: Cloudflare Worker for secure token exchange
- **Domain Setup**: `gettreekit.com` handles both auth page and API endpoints

## Common Development Patterns

### Adding New UI Features
1. Add HTML structure in `createFigtreeUI()` function in `extension/content.js`
2. Add corresponding CSS in the inline style block
3. Implement event handlers after DOM creation
4. Update storage schema if persistent data needed

### Extending API Integration
1. Add new API endpoints in `extension/background.js`
2. Implement caching strategy for new data types in `nodeCache`
3. Update content script to display new information
4. Handle loading states and error conditions

### Modifying OAuth Flow
1. Update `auth.html` for auth page changes
2. Modify `extension/background.js` for extension-side OAuth handling
3. Update server code (`cloudflare-worker/`) for token exchange
4. Test both local development and production environments

### Project Hierarchy Management
- Projects contain Pages contain Frames contain Groups
- Each level has consistent copy/pin/expand functionality
- Filter system searches all levels simultaneously
- Lazy loading prevents unnecessary API calls