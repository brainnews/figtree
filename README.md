# Treekit Chrome Extension

A Chrome extension that allows you to quickly copy direct links to specific elements in your Figma projects through the context menu.

## Features

- Access your starred Figma projects directly from the context menu
- Copy direct links to any level of your Figma project:
  - Project level
  - Page level
  - Frame level
  - Group level
- Instant clipboard copying with visual feedback
- Seamless integration with Figma's web interface
- Secure Figma account authentication

## Setup

1. Clone this repository or download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `treekit` directory
5. Configure your Figma OAuth application:
   - Go to your Figma account settings
   - Navigate to the "OAuth applications" section
   - Create a new OAuth application
   - Set the redirect URI to: `https://<your-extension-id>.chromiumapp.org/`
   - Add the following scopes:
     - `files:read`
     - `user:read`
   - Copy the client ID and update it in the manifest.json file

## Usage

1. Right-click anywhere on a webpage to open the context menu
2. Click on "Treekit" to see your starred projects
   - If you're not logged in, you'll be prompted to authenticate with your Figma account
3. Navigate through the menu structure:
   - Select a project to copy its link
   - Select a page to copy its link
   - Select a frame to copy its link
   - Select a group to copy its link
4. A notification will appear confirming that the link has been copied to your clipboard
5. Paste the link wherever you need it

## Development

To modify or enhance the extension:

1. Make your changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test the changes in your browser

## Requirements

- Chrome browser
- Figma account
- Figma OAuth application credentials

## Security

- The extension uses OAuth 2.0 for secure authentication with Figma
- Access tokens are stored securely in Chrome's local storage
- All API requests are made over HTTPS
- Clipboard operations are performed securely
- No API keys or sensitive credentials are required

## License

MIT License - feel free to use and modify as needed. 