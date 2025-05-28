const cron = require("node-cron")
const { fetchAndStoreEmails } = require("./services/imapService")
const { supabaseAdmin } = require("./utils/supabaseClient")

async function getAllAuthenticatedUserIdsWithImap() {
  console.log("getAllAuthenticatedUserIdsWithImap function started (from cron-jobs.js).")

  try {
    // Fetch all user_id values from the user_settings table where IMAP is fully configured
    // Check for all required IMAP fields based on your schema
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, imap_server, imap_port, main_email_address, imap_password")
      .not("imap_server", "is", null)
      .not("main_email_address", "is", null)
      .not("imap_password", "is", null)
      .not("imap_port", "is", null)

    if (settingsError) {
      console.error("Error fetching user IDs from user_settings (from cron-jobs.js):", settingsError)
      return []
    }

    // Filter out any records with empty strings and get distinct user IDs
    const validSettings = settingsData.filter(
      (setting) =>
        setting.imap_server &&
        setting.imap_server.trim() !== "" &&
        setting.main_email_address &&
        setting.main_email_address.trim() !== "" &&
        setting.imap_password &&
        setting.imap_password.trim() !== "" &&
        setting.imap_port,
    )

    const distinctUserIds = [...new Set(validSettings.map((item) => item.user_id))]
    console.log("User IDs with complete IMAP settings (from cron-jobs.js):", distinctUserIds)

    if (distinctUserIds.length === 0) {
      console.log("No users with complete IMAP settings found (from cron-jobs.js).")
      return []
    }

    return distinctUserIds
  } catch (error) {
    console.error("Unexpected error in getAllAuthenticatedUserIdsWithImap:", error)
    return []
  }
}

// Run every 2 minutes instead of every minute to avoid overwhelming the server
cron.schedule("*/2 * * * *", async () => {
  console.log("Cron job started (from cron-jobs.js)...")
  try {
    const userIds = await getAllAuthenticatedUserIdsWithImap()
    console.log("Users to sync (from cron-jobs.js):", userIds)

    if (userIds.length === 0) {
      console.log("No users to sync, skipping this cycle (from cron-jobs.js).")
      return
    }

    // Process users sequentially to avoid overwhelming IMAP servers
    for (const userId of userIds) {
      try {
        console.log(`Attempting to fetch emails for user ID: ${userId} (from cron-jobs.js)`)
        await fetchAndStoreEmails(userId)
        console.log(`Fetching emails completed for user ID: ${userId} (from cron-jobs.js)`)

        // Add a small delay between users to be respectful to IMAP servers
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Increased to 2 seconds
      } catch (userError) {
        console.error(`Error fetching emails for user ${userId}:`, userError)
        // Continue with next user even if one fails
      }
    }
    console.log("Cron job finished (from cron-jobs.js).")
  } catch (error) {
    console.error("Error during cron job (from cron-jobs.js):", error)
  }
})

console.log("Cron job scheduled to run every 2 minutes (from cron-jobs.js).")
