# Treekit OAuth - Cloudflare Worker

This Cloudflare Worker handles OAuth token exchange for the Treekit Chrome extension, integrating seamlessly with your existing gettreekit.com domain.

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
# Go to Workers > treekit-oauth > Settings > Environment Variables
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
2. Click your **treekit-oauth** worker
3. Go to **Settings** > **Triggers**
4. Add custom domain route: `gettreekit.com/api/oauth/token`

## How It Works

Once deployed, the worker will handle:

- **POST** `https://gettreekit.com/api/oauth/token` - Token exchange
- **OPTIONS** requests for CORS preflight

The worker runs on Cloudflare's edge network, so it's:
- ⚡ **Fast** - No cold starts
- 🌍 **Global** - Runs worldwide
- 🆓 **Free** - 100K requests/day free tier
- 🔒 **Secure** - Environment variables encrypted

## Add OAuth Page to GitHub Pages

The auth.html page is already configured to work with this Cloudflare Worker.

## Testing

Test the worker locally:

```bash
wrangler dev
# Test at http://localhost:8787/api/oauth/token
```

## Benefits of Cloudflare Workers

- ✅ Same domain (gettreekit.com)
- ✅ Integrated with your existing Cloudflare setup
- ✅ No subdomain or DNS configuration needed
- ✅ Faster (edge computing)
- ✅ Free tier generous for this use case
- ✅ Works seamlessly with Cloudflare Pages