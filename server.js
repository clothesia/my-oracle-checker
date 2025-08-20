const express = require('express');
const net = require('net');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve index.html

// Website/domain checker using AllOrigins proxy
async function checkWebsite(url) {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;

    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();

    // If we get a valid response, the site is online
    if (data && data.contents) {
      return { online: true };
    } else {
      return { online: false, error: 'Empty response from proxy' };
    }
  } catch (err) {
    return { online: false, error: err.message };
  }
}

// Server/IP checker with optional port
function checkServer(host, port = 80, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve({ online: true }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ online: false }); });
    socket.on('error', () => { socket.destroy(); resolve({ online: false }); });
    socket.connect(port, host);
  });
}

// API endpoint
app.post('/check', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'No input provided' });

  const items = input.split(',').map(s => s.trim()).filter(Boolean);

  const results = await Promise.all(items.map(async (item) => {
    // Detect IP with optional port (e.g., 123.45.67.89:22)
    const ipPortMatch = item.match(/^(\d{1,3}(\.\d{1,3}){3})(:(\d{1,5}))?$/);
    if (ipPortMatch) {
      const host = ipPortMatch[1];
      const port = ipPortMatch[4] ? parseInt(ipPortMatch[4]) : 80;
      return { input: item, type: 'server', ...(await checkServer(host, port)) };
    }

    // Otherwise treat as website/domain
    try {
      return { input: item, type: 'website', ...(await checkWebsite(item)) };
    } catch {
      return { input: item, type: 'unknown', online: false };
    }
  }));

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
