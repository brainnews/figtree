# Figtree OAuth - Cloudflare Worker

This Cloudflare Worker handles OAuth token exchange for the Figtree Chrome extension, integrating seamlessly with your existing getfigtree.com domain.

## Setup Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
# or
npm install wrangler --save-dev
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Set Environment Variable

Set the Figma client secret in Cloudflare dashboard:

```bash
# Option A: Via CLI
wrangler secret put FIGMA_CLIENT_SECRET
# Enter: aZy7fIw50AZmEyvriMdz0tnousQQYV

# Option B: Via Cloudflare Dashboard
# Go to Workers > figtree-oauth > Settings > Environment Variables
# Add: FIGMA_CLIENT_SECRET = aZy7fIw50AZmEyvriMdz0tnousQQYV
```

### 4. Deploy Worker

```bash
# Navigate to worker directory
cd cloudflare-worker

# Deploy to production
wrangler deploy
```

### 5. Configure Route (if not auto-configured)

If the route doesn't work automatically:

1. Go to **Cloudflare Dashboard** > **Workers & Pages**
2. Click your **figtree-oauth** worker
3. Go to **Settings** > **Triggers**
4. Add custom domain route: `getfigtree.com/api/oauth/token`

## How It Works

Once deployed, the worker will handle:

- **POST** `https://getfigtree.com/api/oauth/token` - Token exchange
- **OPTIONS** requests for CORS preflight

The worker runs on Cloudflare's edge network, so it's:
- ⚡ **Fast** - No cold starts
- 🌍 **Global** - Runs worldwide
- 🆓 **Free** - 100K requests/day free tier
- 🔒 **Secure** - Environment variables encrypted

## Add OAuth Page to GitHub Pages

Add this to your GitHub Pages repository as `oauth.html`:

```html
<!-- Copy the content from server/public/oauth.html -->
```

## Testing

Test the worker locally:

```bash
wrangler dev
# Test at http://localhost:8787/api/oauth/token
```

## Benefits vs Vercel

- ✅ Same domain (getfigtree.com)
- ✅ Integrated with your existing Cloudflare setup
- ✅ No subdomain or DNS configuration needed
- ✅ Faster (edge computing)
- ✅ Free tier more generous for this use case
- ✅ Works seamlessly with GitHub Pages