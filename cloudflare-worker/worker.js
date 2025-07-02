// Cloudflare Worker for Figtree OAuth token exchange
// Deploy this to handle POST /api/oauth/token

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only handle POST requests to /api/oauth/token
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/oauth/token') {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Parse request body
      const body = await request.json();
      const { code, redirect_uri, client_id } = body;

      // Validate required parameters
      if (!code || !redirect_uri || !client_id) {
        return new Response(JSON.stringify({ 
          error: 'Missing required parameters: code, redirect_uri, client_id' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate client_id matches expected value
      if (client_id !== 'qTujZ7BNoSdMdVikl3RaeD') {
        return new Response(JSON.stringify({ 
          error: 'Invalid client_id' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get client secret from environment variable
      const client_secret = env.FIGMA_CLIENT_SECRET;
      if (!client_secret) {
        console.error('FIGMA_CLIENT_SECRET environment variable not set');
        return new Response(JSON.stringify({ 
          error: 'Server configuration error' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('Exchanging code for token:', {
        client_id,
        redirect_uri,
        code: code.substring(0, 8) + '...' // Log partial code for debugging
      });

      // Exchange authorization code for access token with Figma
      const tokenResponse = await fetch('https://api.figma.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: client_id,
          client_secret: client_secret,
          redirect_uri: redirect_uri,
          code: code,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenResponse.text();
      
      if (!tokenResponse.ok) {
        console.error('Figma token exchange failed:', {
          status: tokenResponse.status,
          response: tokenData
        });

        // Parse error if possible
        let errorMessage = 'Token exchange failed';
        try {
          const errorJson = JSON.parse(tokenData);
          errorMessage = errorJson.message || errorMessage;
        } catch (e) {
          // Use default message if parsing fails
        }

        return new Response(JSON.stringify({ 
          error: errorMessage,
          details: tokenData
        }), {
          status: tokenResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Parse successful response
      let tokenJson;
      try {
        tokenJson = JSON.parse(tokenData);
      } catch (e) {
        console.error('Failed to parse token response:', tokenData);
        return new Response(JSON.stringify({ 
          error: 'Invalid response from Figma' 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log('Token exchange successful');

      // Return only the access token (don't log it for security)
      return new Response(JSON.stringify({
        access_token: tokenJson.access_token,
        token_type: tokenJson.token_type || 'Bearer',
        scope: tokenJson.scope
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } catch (error) {
      console.error('Server error during token exchange:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },
};