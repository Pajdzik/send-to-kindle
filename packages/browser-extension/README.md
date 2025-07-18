# Send to Kindle Browser Extension

A browser extension for Chrome and Firefox that allows you to send web pages to your Kindle device via email.

## Features

- Extract clean content from web pages
- Send articles directly to your Kindle email
- Simple configuration interface
- Right-click context menu for quick sending
- Support for both Chrome and Firefox

## Installation

### Development Installation

1. Build the extension:
   ```bash
   npm run build
   ```

2. **For Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

3. **For Firefox:**
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file in the `dist/` folder

### Production Installation

1. Create a packaged extension:
   ```bash
   npm run package
   ```

2. This creates `browser-extension.zip` which can be uploaded to browser extension stores.

## Configuration

1. Click the extension icon in your browser toolbar
2. Enter your Kindle email address (e.g., `your-kindle@kindle.com`)
3. Enter your worker URL (where your url-to-kindle-worker is deployed)
4. Click "Save Configuration"

## Usage

### Method 1: Extension Popup
1. Navigate to any web page
2. Click the extension icon
3. Click "Send to Kindle"

### Method 2: Context Menu
1. Right-click on any web page
2. Select "Send to Kindle" from the context menu

## Requirements

- A deployed instance of the `url-to-kindle-worker`
- A valid Kindle email address
- Resend API key configured in your worker

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Watch for changes
npm run dev

# Type checking
npm run typecheck

# Create production package
npm run package
```

## Browser Compatibility

- Chrome/Chromium (Manifest V3)
- Firefox (Manifest V3 compatible)
- Edge (Chromium-based)