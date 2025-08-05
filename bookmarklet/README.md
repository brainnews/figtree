# Figtree Bookmarklet

> Quick access to your Figma projects from any webpage

The Figtree bookmarklet is a browser-universal version of the Figtree Chrome extension, designed to work across all modern browsers without installation requirements.

## 🌟 Features

- **🔐 Simple Authentication**: Clean OAuth flow with popup authentication
- **📁 Project Management**: Add, organize, and browse your Figma projects
- **📌 Pin Favorites**: Pin frequently used projects, pages, frames, and groups
- **🔍 Smart Search**: Search across all your projects and hierarchy
- **📋 One-Click Copying**: Copy direct links to any Figma element
- **🌐 Universal Compatibility**: Works in Chrome, Safari, Firefox, Edge
- **💾 Local Storage**: All data stored locally in your browser

## 🚀 Installation

### Method 1: Drag to Bookmarks Bar
1. Open `demo/index.html` in your browser
2. Drag the "🌳 Figtree" button to your bookmarks bar
3. Click the bookmark on any webpage to launch Figtree

### Method 2: Manual Bookmark Creation
1. Create a new bookmark in your browser
2. Set the name to "Figtree"
3. Copy the bookmarklet code from `dist/bookmarklet.js`
4. Paste it as the URL/location

### Method 3: Right-click Bookmark
1. Right-click the bookmarklet button on the demo page
2. Select "Bookmark this link" or "Add to bookmarks"

## 📁 Project Structure

```
bookmarklet/
├── src/
│   ├── loader.js           # Minimal bookmarklet loader
│   ├── app/
│   │   ├── main.js         # Core application logic
│   │   ├── auth.js         # OAuth authentication
│   │   ├── storage.js      # localStorage abstraction
│   │   └── figma-api.js    # Figma API integration
│   └── ui/
│       ├── panel.js        # UI panel creation
│       ├── events.js       # Event handlers
│       └── projects.js     # Project hierarchy rendering
├── dist/                   # Built files
├── demo/                   # Demo page and OAuth callback
└── build/                  # Build scripts
```

## 🔧 Development

### Building
```bash
cd bookmarklet
node build/build.js
```

This creates:
- `dist/figtree-app.js` - Combined source code
- `dist/figtree-app.min.js` - Minified version  
- `dist/bookmarklet.js` - Production bookmarklet
- `dist/bookmarklet-dev.js` - Development bookmarklet

### Local Testing
1. Run a local server: `python -m http.server 3000`
2. Open `demo/index.html` in your browser
3. Use the development bookmarklet for testing

### OAuth Setup
The bookmarklet uses the same OAuth configuration as the Chrome extension:
- **Client ID**: `qTujZ7BNoSdMdVikl3RaeD`
- **Redirect URI**: `https://www.getfigtree.com/oauth.html`
- **Scopes**: `files:read`

For development, update the redirect URI to point to your local callback page.

## 🏗️ Architecture

### Authentication Flow
1. User clicks bookmarklet
2. If not authenticated, popup opens with Figma OAuth
3. User authorizes in popup
4. Callback page sends credentials via `postMessage`
5. Main app receives credentials and stores access token

### Storage System
- **localStorage** used instead of Chrome extension storage
- **JSON serialization** for complex data structures
- **Namespace prefix** (`figtree_`) prevents conflicts
- **Automatic cleanup** of expired data

### API Integration
- **Direct Figma API calls** with proper error handling
- **Caching system** to reduce API requests
- **CORS handling** for cross-origin requests
- **Rate limiting** awareness and retry logic

### UI System
- **CSS isolation** with prefixed selectors and `!important`
- **Draggable panel** that works on any website
- **Responsive design** adapting to different screen sizes
- **Event delegation** for dynamic content

## 📊 Comparison with Chrome Extension

| Feature | Chrome Extension | Bookmarklet |
|---------|------------------|-------------|
| **Installation** | Chrome Web Store | Drag to bookmarks |
| **Authentication** | Complex OAuth | Simple popup OAuth |
| **Storage** | Chrome APIs + Sync | localStorage only |
| **Permissions** | Extensive | None required |
| **Cross-browser** | Chrome only | All modern browsers |
| **Background processing** | Service worker | Manual triggers only |
| **Data sync** | Cross-device | Single browser only |
| **Update mechanism** | Auto-update | Manual refresh |

## 🔒 Security & Privacy

- **Local storage only**: No data sent to external servers except Figma API
- **OAuth security**: Uses state parameter and popup isolation
- **HTTPS requirement**: All API calls over secure connections
- **No tracking**: No analytics or user behavior monitoring
- **Isolated execution**: Runs in its own scope to avoid conflicts

## 🚨 Limitations

- **Single browser**: Data doesn't sync across browsers/devices
- **Storage limits**: Subject to localStorage size restrictions (~5-10MB)
- **Manual refresh**: No background updates (must click bookmarklet)
- **Session-based**: Access tokens expire and require re-authentication
- **CORS dependent**: Some API endpoints may require proxy in future

## 🛠️ Troubleshooting

### Bookmarklet Won't Load
- Check browser console for JavaScript errors
- Verify the CDN URL is accessible
- Try the development version with localhost

### Authentication Fails
- Ensure popups are allowed for the current site
- Check if third-party cookies are enabled
- Verify OAuth redirect URI configuration

### UI Conflicts
- The bookmarklet uses CSS isolation with `!important`
- If conflicts occur, inspect elements and adjust specificity
- Report issues with specific websites

### Storage Issues
- Check localStorage availability: `localStorage.getItem('test')`
- Clear Figtree data: Settings → Clear All Data
- Browser may have storage quotas or restrictions

## 🚀 Deployment

### Development
```javascript
// Points to localhost:3000
javascript:(function(){/* ... */script.src='http://localhost:3000/figtree-app.js';/* ... */})();
```

### Production
```javascript
// Points to CDN
javascript:(function(){/* ... */script.src='https://cdn.jsdelivr.net/gh/user/repo@branch/dist/figtree-app.min.js';/* ... */})();
```

### Self-hosted
1. Upload `dist/` files to your web server
2. Update the CDN URL in the bookmarklet
3. Ensure CORS headers allow cross-origin access

## 📝 License

Same as the main Figtree project - check the root LICENSE file.

## 🤝 Contributing

1. Make changes in the `src/` directory
2. Test with the development bookmarklet
3. Run `node build/build.js` to create distribution files
4. Submit a pull request with your changes

## 📞 Support

- **Issues**: Report bugs in the main Figtree repository
- **Feature requests**: Use GitHub issues with "bookmarklet" label
- **Documentation**: Check the demo page for usage examples

---

Built with ❤️ for universal Figma access