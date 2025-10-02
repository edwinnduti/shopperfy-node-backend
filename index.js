// server.js

// Import required libraries
const express = require('express');
const cors = require('cors');
//onst fetch = require('node-fetch');
const { URLSearchParams } = require('url');

// --- Configuration and Environment Variables ---
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8090;

// TZN
const clientIDTZN = "zk2uwmsriqj2hhgygqvbv6w0nlhde4c6";
const clientSecretTZN = "TGRmo983xTSJQ2SwZNzL3E2P8VX8N6UK";

// DRC
const clientIDDRC = "dduzwvlgz0ncl1ljcxowns0xcbea20jo";
const clientSecretDRC = "TN5qiQ2VY3vCmROXzcg8nie58vbBklGb";

// In-memory refund store
// Structure: { transactionId: { refunds: [ {item, amount, reason, ThirdPartyConversationID, status} ] } }
const refundsStore = {};

const getCredentialsBasedOnMarket = (country) => {
  if (country === "TZA" || country === "TZN") {
    return {
      clientID: clientIDTZN, 
      clientSecret: clientSecretTZN
    };
  }
  if (country === "COD" || country === "DRC") {
    return {
      clientID: clientIDDRC, 
      clientSecret: clientSecretDRC
    };
  }
};

const allowedOrigins = [
  '*',
  'http://localhost:8080',
  'https://shopperfy.vercel.app',
  'https://uat.openapiportal.m-pesa.com'
];

app.use(cors({
  // origin: function (origin, callback) {
  //   // Allow requests with no origin (like mobile apps or curl)
  //   if (!origin) return callback(null, true);
    
  //   // Check if the requesting origin is in the allowed list
  //   if (allowedOrigins.includes(origin)) {
  //     return callback(null, true);
  //   }
    
  //   // Block if the origin is not allowed
  //   const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
  //   return callback(new Error(msg), false);
  // },
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// --- Helper Functions ---

const truncatedToken = (accessToken) => {
  return accessToken.slice(0, 5) + '...';
};

// getAccessToken makes a POST request to get an access token.
const getAccessToken = async (clientID, clientSecret) => {
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
app.post('/process-payment-single', async (req, res) => {
  const externalAPIURL = "https://uat.openapiportal.m-pesa.com/vpp/api/v1/vodapartner/payments/";
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

// Replaces handlePayment Multi stage
app.post('/process-payment-multi', async (req, res) => {
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
  console.log("Received update-transaction payload:", payload);

  // Get credentials
  let {clientID, clientSecret} = getCredentialsBasedOnMarket(payload.input_Country);

  try {
    const accessToken = await getAccessToken(clientID, clientSecret);

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

  // Get credentials
  let {clientID, clientSecret} = getCredentialsBasedOnMarket(queryParams.input_Country);

  try {
    const accessToken = await getAccessToken(clientID, clientSecret);

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

// webhook url
app.post('/webhook', (req, res) => {
  // Check if the request has a Content-Type header of 'application/json'
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    // If not, return a 415 Unsupported Media Type error
    return res.status(415).json({
      error: 'Unsupported Content-Type. Server requires application/json.'
    });
  }

  // 1. "Pick the data" from the request body.
  const receivedData = req.body;

  // Log the received data to the console for debugging
  console.log('Webhook received data:');
  console.log(receivedData);

  // 2. "Return it" by sending a JSON response.
  // The client will get a 200 OK status.
  res.status(200).json({
    message: "Data received successfully!",
    data: receivedData
  });
});

// 1. Partial Refund API
app.put('/refund', async (req, res) => {
  const externalAPIURL = "https://uat.openapi.m-pesa.com:19050/openapi/ipg/v3/psp/intReturnFunds/";
  const payload = req.body;
  const { input_Country, input_TransactionID, item, reason } = payload;

  if (!input_TransactionID) {
    return res.status(400).json({ error: "input_TransactionID is required" });
  }

  // Get credentials for market
  let {clientID, clientSecret} = getCredentialsBasedOnMarket(input_Country);

  try {
    const accessToken = await getAccessToken(clientID, clientSecret);

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
    console.log(`Refund API responded with status ${response.status} and body:`, responseBody);

    // Save refund in memory
    if (!refundsStore[input_TransactionID]) {
      refundsStore[input_TransactionID] = { refunds: [] };
    }

    refundsStore[input_TransactionID].refunds.push({
      item: item || "Unknown Item",
      amount: payload.input_ReversalAmount,
      reason: reason || "No reason provided",
      ThirdPartyConversationID: payload.input_ThirdPartyConversationID,
      status: responseBody.output_ResponseCode === "INS-GAR-0" ? "SUCCESS" : "FAILED"
    });

    res.status(response.status).json(responseBody);
  } catch (error) {
    console.error(`Refund API request failed: ${error.message}`);
    res.status(502).json({ error: `Refund API request failed: ${error.message}` });
  }
});

// 2. Query Refund Status API
app.put('/query-refund', async (req, res) => {
  const externalAPIURL = "https://uat.openapi.m-pesa.com:19050/openapi/ipg/v3/psp/intRefundQuery/";
  const payload = req.body;
  const { input_Country } = payload;

  // Get credentials
  let {clientID, clientSecret} = getCredentialsBasedOnMarket(input_Country);

  try {
    const accessToken = await getAccessToken(clientID, clientSecret);

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
    console.log(`Refund Query API responded with status ${response.status} and body:`, responseBody);

    res.status(response.status).json(responseBody);
  } catch (error) {
    console.error(`Refund Query API request failed: ${error.message}`);
    res.status(502).json({ error: `Refund Query API request failed: ${error.message}` });
  }
});

// 3. Local endpoint to view in-memory refund history
app.get('/refunds/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const refunds = refundsStore[transactionId];

  if (!refunds) {
    return res.status(404).json({ error: "No refunds found for this transaction ID" });
  }

  res.json(refunds);
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});