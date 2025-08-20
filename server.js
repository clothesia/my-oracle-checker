const express = require('express');
const net = require('net');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve index.html

// Check website
async function checkWebsite(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    return { online: response.ok, status: response.status };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

// Check server/IP
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
    try {
      let url = new URL(item.startsWith('http') ? item : 'https://' + item);
      return { input: item, type: 'website', ...(await checkWebsite(url.href)) };
    } catch {
      const [host, portStr] = item.split(':');
      const port = portStr ? parseInt(portStr) : 80;
      return { input: item, type: 'server', ...(await checkServer(host, port)) };
    }
  }));

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
