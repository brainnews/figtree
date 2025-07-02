// Serverless function for Figma OAuth token exchange
// This can be deployed to Vercel, Netlify, or any serverless platform

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri, client_id } = req.body;

    // Validate required parameters
    if (!code || !redirect_uri || !client_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters: code, redirect_uri, client_id' 
      });
    }

    // Validate client_id matches expected value
    if (client_id !== 'qTujZ7BNoSdMdVikl3RaeD') {
      return res.status(400).json({ error: 'Invalid client_id' });
    }

    // Get client secret from environment variable
    const client_secret = process.env.FIGMA_CLIENT_SECRET;
    if (!client_secret) {
      console.error('FIGMA_CLIENT_SECRET environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
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

      return res.status(tokenResponse.status).json({ 
        error: errorMessage,
        details: tokenData
      });
    }

    // Parse successful response
    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenData);
    } catch (e) {
      console.error('Failed to parse token response:', tokenData);
      return res.status(500).json({ error: 'Invalid response from Figma' });
    }

    console.log('Token exchange successful');

    // Return only the access token (don't log it for security)
    return res.status(200).json({
      access_token: tokenJson.access_token,
      token_type: tokenJson.token_type || 'Bearer',
      scope: tokenJson.scope
    });

  } catch (error) {
    console.error('Server error during token exchange:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}