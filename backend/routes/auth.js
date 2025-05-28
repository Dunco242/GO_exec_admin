const express = require('express');
const router = express.Router();
const { connectImapAccount } = require('../services/imapService'); // Assuming you'll create this function

router.post('/connect-imap', async (req, res) => {
  const { host, port, username, password, tls } = req.body;
  console.log('Received IMAP credentials in backend (auth route):', { host, port, username, password, tls });

  try {
    const result = await connectImapAccount(req.body); // Call the service to handle the connection
    res.status(200).json({ message: 'IMAP account connected successfully.', data: result });
  } catch (error) {
    console.error('Error connecting IMAP account:', error);
    res.status(400).json({ error: error.message || 'Failed to connect IMAP account.' });
  }
});

module.exports = router;
