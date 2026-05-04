// API key authentication for NFC reader devices (headless, no JWT)
function authenticateDevice(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.NFC_API_KEY;

  if (!expectedKey) {
    console.error('NFC_API_KEY not configured in environment');
    return res.status(500).json({ error: 'NFC service not configured' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = { authenticateDevice };
