# Figtree OAuth Server

This serverless function handles OAuth token exchange for the Figtree Chrome extension, since Figma requires a client secret that cannot be stored in browser extensions.

## Setup

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to server directory
cd server

# Deploy to Vercel
vercel --prod
```

### 2. Set Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variable:

```
FIGMA_CLIENT_SECRET=aZy7fIw50AZmEyvriMdz0tnousQQYV
```

### 3. Update Extension Configuration

Update the extension's `config.js` to point to your deployed server:

```javascript
EXTERNAL_REDIRECT_URL: 'https://your-vercel-app.vercel.app/oauth.html'
```

And update the token exchange URL in `background.js`:

```javascript
const response = await fetch('https://your-vercel-app.vercel.app/api/oauth/token', {
```

## API Endpoint

### POST /api/oauth/token

Exchanges Figma authorization code for access token.

**Request:**
```json
{
  "code": "authorization_code_from_figma",
  "redirect_uri": "https://your-domain.com/oauth.html",
  "client_id": "qTujZ7BNoSdMdVikl3RaeD"
}
```

**Response:**
```json
{
  "access_token": "figma_access_token",
  "token_type": "Bearer",
  "scope": "files:read"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Security Features

- CORS headers for browser compatibility
- Environment variable for client secret
- Request validation
- Error handling and logging
- No sensitive data logged

## Alternative Deployment Options

### Netlify Functions

Create `netlify/functions/oauth-token.js`:

```javascript
exports.handler = async (event, context) => {
  // Same logic as Vercel function
  // Return { statusCode, headers, body }
}
```

### AWS Lambda

Deploy using AWS SAM or Serverless Framework with the same logic.

### Traditional Server

Deploy to any Node.js hosting service like Railway, Render, or DigitalOcean.