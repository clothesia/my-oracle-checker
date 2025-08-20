const express = require('express');
const net = require('net');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve index.html

// Robust website checker
async function checkWebsite(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return { online: response.ok, status: response.status };
  } catch (err) {
    clearTimeout(timeout);
    return { online: false, error: err.message };
  }
}

// Check server/IP with optional port
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

// Determine if input is IP or domain, then check
app.post('/check', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'No input provided' });

  const items = input.split(',').map(s => s.trim()).filter(Boolean);

  const results = await Promise.all(items.map(async (item) => {
    // Check for IP with optional port
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
