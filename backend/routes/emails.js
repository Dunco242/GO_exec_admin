// backend/routes/emails.js
const express = require('express');
const router = express.Router();
const { fetchAndStoreEmails } = require('../services/imapService');
const { protect } = require('../middleware/auth'); // Example auth middleware
const cron = require('node-cron');
const { supabase } = require('../utils/supabaseClient'); // Ensure you import supabase

async function getAllAuthenticatedUserIdsWithImap() {
  console.log('getAllAuthenticatedUserIdsWithImap function started.');
  const { data, error } = await supabase
    .from('clients') // Adjust table name if needed
    .select('id')
    .innerJoin('settings', 'clients.id', 'settings.user_id'); // Adjust join columns if needed

  if (error) {
    console.error('Error fetching user IDs with IMAP settings:', error);
    console.log('getAllAuthenticatedUserIdsWithImap function finished with error.');
    return [];
  }
  console.log('Fetched user IDs with IMAP settings:', data.map(user => user.id));
  console.log('getAllAuthenticatedUserIdsWithImap function finished successfully.');
  return data.map(user => user.id);
}

// Schedule the email fetching task to run every minute for testing
cron.schedule('*/1 * * * *', async () => {
  console.log('Cron job started from emails.js...');
  try {
    const userIds = await getAllAuthenticatedUserIdsWithImap();
    console.log('Users to sync:', userIds);
    for (const userId of userIds) {
      console.log(`Attempting to fetch emails for user ID: ${userId}`);
      await fetchAndStoreEmails(userId);
      console.log(`Fetching emails completed for user ID: ${userId}`);
    }
    console.log('Cron job finished from emails.js.');
  } catch (error) {
    console.error('Error during cron job in emails.js:', error);
  }
});

router.post('/sync', protect, async (req, res) => {
  const userId = req.user.id; // Get user ID from authenticated request
  console.log(`Manual email sync requested for user ID: ${userId}`);
  try {
    await fetchAndStoreEmails(userId);
    res.json({ message: 'Email sync initiated successfully.' });
  } catch (error) {
    console.error('Error during manual email sync:', error);
    res.status(500).json({ error: 'Failed to sync emails.' });
  }
});

module.exports = router;
