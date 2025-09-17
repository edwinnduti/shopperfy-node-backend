// server.js

// Import required libraries
const express = require('express');
const cors = require('cors');
//onst fetch = require('node-fetch');
const { URLSearchParams } = require('url');

// --- Configuration and Environment Variables ---
const app = express();
const PORT = process.env.PORT || 8090;

const clientID = "zk2uwmsriqj2hhgygqvbv6w0nlhde4c6";
const clientSecret = "TGRmo983xTSJQ2SwZNzL3E2P8VX8N6UK";

// --- Middleware ---
// Replaces negroni.Classic() and gorilla/handlers.CORS()
app.use(express.json()); // Allows the server to parse JSON bodies
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- Helper Functions ---

const truncatedToken = (accessToken) => {
  return accessToken.slice(0, 5) + '...';
};

// getAccessToken makes a POST request to get an access token.
const getAccessToken = async () => {
  const url = "https://uat.openapi.m-pesa.com:19050/openapi/ipg/v3/psp/auth/";

  const params = new URLSearchParams();
  params.append('client_id', clientID);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'client_credentials');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status code ${response.status}: ${errorText}`);
    }

    const tokenData = await response.json();
    console.log(`Successfully obtained access token:\n${truncatedToken(tokenData.access_token)}`);

    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
};


// --- Route Handlers ---

// Replaces handlePayment
app.post('/process-payment', async (req, res) => {
  const externalAPIURL = "https://uat.openapiportal.m-pesa.com/vpp/api/v1/vodapartner/paymentsMultistage/";
  const payload = req.body;

  console.log("Received payload:", payload);

  try {
    const response = await fetch(externalAPIURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseBody = await response.json();
    console.log(`External API responded with status ${response.status} and body:`, responseBody);

    res.status(response.status).json(responseBody);
  } catch (error) {
    console.error(`External API request failed: ${error.message}`);
    res.status(502).json({ error: `External API request failed: ${error.message}` });
  }
});

// Replaces handleTransactionStatusUpdate
app.put('/update-transaction', async (req, res) => {
  const externalAPIURL = "https://uat.openapi.m-pesa.com:19050/openapi/ipg/v3/psp/intUpdateTransactionStatus/";
  const payload = req.body;
  console.log("Received payload:", payload);

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(externalAPIURL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Origin': '*',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const responseBody = await response.json();
    console.log(`External API responded with status ${response.status} and body:`, responseBody);

    res.status(response.status).json(responseBody);
  } catch (error) {
    console.error(`External API request failed: ${error.message}`);
    res.status(502).json({ error: `External API request failed: ${error.message}` });
  }
});

// Replaces queryTransactionStatusHandler
app.get('/query-status', async (req, res) => {
  const externalAPIURL = "https://uat.openapi.m-pesa.com:19050/openapi/ipg/v3/psp/intQTS/";
  const queryParams = req.query;

  // Basic validation
  if (!queryParams.input_QueryReference) {
    return res.status(400).json({ error: "input_QueryReference parameter is required" });
  }

  // Construct the URL with query parameters
  const url = new URL(externalAPIURL);
  Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': '*',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const responseBody = await response.json();
    console.log(`External API responded with status ${response.status} and body:`, responseBody);

    res.status(response.status).json(responseBody);
  } catch (error) {
    console.error(`External API request failed: ${error.message}`);
    res.status(502).json({ error: `External API request failed: ${error.message}` });
  }
});


// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});