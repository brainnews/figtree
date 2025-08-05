# Figtree Bookmarklet - Local Development Setup

## Quick Start with Live Server (127.0.0.1:5500)

### 1. Start Live Server
If using VS Code with Live Server extension:
1. Right-click on the project folder
2. Select "Open with Live Server"
3. It should start at `http://127.0.0.1:5500/`

Or use any other local server:
```bash
# Python
python -m http.server 5500 --bind 127.0.0.1

# Node.js (if you have http-server installed)
npx http-server -p 5500 -a 127.0.0.1

# PHP
php -S 127.0.0.1:5500
```

### 2. Open Demo Page
Navigate to: `http://127.0.0.1:5500/bookmarklet/demo/index.html`

### 3. Test Bookmarklet
1. **Drag the "🌳 Figtree" button** to your bookmarks bar
2. **Click the bookmark** on any website to test
3. You should see "🌳 Loading Figtree..." appear

## Different Development Servers

The build script generates bookmarklets for different environments:

### Available Bookmarklet Versions:
- `bookmarklet.js` - Production (CDN)
- `bookmarklet-dev.js` - localhost:3000
- `bookmarklet-liveserver.js` - 127.0.0.1:5500

### To Use Different Server:
If you want to use a different development server:

1. **Edit the build script** (`build/build.js`):
```javascript
const yourServerBookmarklet = createSimpleBookmarklet('http://your-server:port/bookmarklet/dist/');
```

2. **Rebuild**:
```bash
node build/build.js
```

3. **Demo page will auto-update** with new bookmarklet

## Testing Steps

1. **Serve the project** at `127.0.0.1:5500`
2. **Open demo page** in browser
3. **Drag bookmarklet** to bookmarks bar
4. **Go to any website** (e.g., google.com)
5. **Click the Figtree bookmark**
6. **Should see loading indicator**, then Figtree panel

## Troubleshooting

### Bookmarklet not loading?
- Check browser console for errors
- Verify server is running at correct address
- Make sure CORS isn't blocking the request

### "Failed to load Figtree" alert?
- Check that `figtree-app.min.js` exists in `dist/` folder
- Verify server can serve the JavaScript file
- Run build script to regenerate files

### Files not found?
Make sure your project structure is:
```
your-project/
├── bookmarklet/
│   ├── dist/           # Built files must be here
│   │   ├── figtree-app.min.js
│   │   └── ...
│   ├── demo/           # Demo page
│   └── ...
```

### Server Issues?
- Try different port: `python -m http.server 8000 --bind 127.0.0.1`
- Update build script with new port
- Rebuild: `node build/build.js`

## Development Workflow

1. **Make changes** to source files in `src/`
2. **Rebuild**: `node build/build.js`
3. **Refresh browser** to test new bookmarklet
4. **Demo page automatically updates** with latest bookmarklet

Happy coding! 🌳