const Imap = require("node-imap")
const { simpleParser } = require("mailparser")
const { supabaseAdmin } = require("../utils/supabaseClient")

async function connectImapAccount(imapConfig) {
  const { host, port, username, password, tls } = imapConfig

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: username,
      password: password,
      host: host,
      port: Number.parseInt(port),
      tls: tls,
      keepalive: true,
    })

    // Log raw welcome message on initial connection
    imap.once("connect", () => {
      console.log("IMAP connected (raw welcome):", imap.serverGreeting)
    })

    // Handle successful connection and open INBOX
    imap.once("ready", () => {
      console.log(`IMAP connection successful for user: ${username}`)
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          console.error("Error opening mailbox for connection test:", err)
          imap.end()
          reject(err)
          return
        }
        console.log("Mailbox opened for connection test:", box.name)
        // End IMAP connection after successful test
        imap.end()
        resolve({ status: "connected", user: username })
      })
    })

    // Handle connection errors
    imap.once("error", (err) => {
      console.error(`IMAP connection error for user: ${username}`, err)
      imap.end()
      reject(new Error(`IMAP connection failed: ${err.message}`))
    })

    // Handle IMAP connection end
    imap.once("end", () => {
      console.log("IMAP connection test ended")
    })

    imap.connect()
  })
}

async function fetchAndStoreEmails(userId) {
  console.log(`fetchAndStoreEmails started for userId: ${userId}`)
  try {
    const userImapConfig = await getUserImapConfig(userId)
    if (!userImapConfig) {
      const errorMessage = "IMAP configuration not found for user."
      console.error(errorMessage)
      throw new Error(errorMessage)
    }
    console.log("getUserImapConfig result:", userImapConfig)

    // Get the last fetched email date for this user to enable incremental sync
    const { data: lastEmail, error: lastEmailError } = await supabaseAdmin
      .from("emails")
      .select("sent_at, message_id")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(1)

    let lastFetchDate = null
    if (lastEmail && lastEmail.length > 0) {
      lastFetchDate = new Date(lastEmail[0].sent_at)
      console.log(`Last email date for user ${userId}:`, lastFetchDate)
    } else {
      // If no emails exist, fetch emails from the last 7 days to avoid overwhelming
      lastFetchDate = new Date()
      lastFetchDate.setDate(lastFetchDate.getDate() - 7)
      console.log(`No previous emails found for user ${userId}, fetching from:`, lastFetchDate)
    }

    const imap = new Imap({
      user: userImapConfig.main_email_address,
      password: userImapConfig.imap_password,
      host: userImapConfig.imap_server,
      port: Number.parseInt(userImapConfig.imap_port),
      tls: true,
      keepalive: true,
      tlsOptions: { rejectUnauthorized: false }, // Add this for better compatibility
    })

    return new Promise((resolve, reject) => {
      // Log raw welcome message on initial connection for cron job
      imap.once("connect", () => {
        console.log("IMAP connected (raw welcome for cron job):", imap.serverGreeting)
      })

      imap.once("ready", async () => {
        console.log(`IMAP ready for user: ${userImapConfig.main_email_address}`)
        try {
          imap.openBox("INBOX", true, async (err, box) => {
            if (err) {
              console.error("Error opening mailbox:", err)
              imap.end()
              reject(err)
              return
            }
            console.log("Mailbox opened:", box.name, "Total messages:", box.messages.total)

            // Build search criteria for incremental sync
            let searchCriteria = ["UNSEEN"] // Start with unseen emails

            // Also search for emails since the last fetch date
            if (lastFetchDate) {
              const searchDate = lastFetchDate.toISOString().split("T")[0] // YYYY-MM-DD format
              searchCriteria = [["UNSEEN"], ["SINCE", searchDate]] // OR condition
            }

            console.log("Search criteria:", searchCriteria)

            imap.search(searchCriteria, async (err, results) => {
              if (err) {
                console.error("Error searching emails:", err)
                imap.end()
                reject(err)
                return
              }
              console.log("Search results (UIDs):", results)

              if (results && results.length > 0) {
                console.log(`Found ${results.length} emails to process for user ${userId}`)

                const fetchPromises = results.map((uid) => {
                  return new Promise((resolveFetch, rejectFetch) => {
                    const f = imap.fetch(uid, {
                      bodies: "",
                      struct: true,
                      envelope: true,
                    })

                    f.on("message", (msg) => {
                      msg.on("body", (stream) => {
                        simpleParser(stream, async (err, parsed) => {
                          if (err) {
                            console.error("Error parsing email:", err)
                            rejectFetch(err)
                            return
                          }

                          try {
                            // Check if this email already exists by message_id
                            if (parsed.messageId) {
                              const { data: existingEmail } = await supabaseAdmin
                                .from("emails")
                                .select("id")
                                .eq("user_id", userId)
                                .eq("message_id", parsed.messageId)
                                .single()

                              if (existingEmail) {
                                console.log(
                                  `Email with message-id ${parsed.messageId} already exists for user ${userId}, skipping`,
                                )
                                resolveFetch()
                                return
                              }
                            }

                            // Helper function to safely get addresses as an array
                            const getAddresses = (addressField) => {
                              if (!addressField) return []
                              if (Array.isArray(addressField)) {
                                return addressField.map((a) => a.address || a)
                              }
                              if (addressField.value && Array.isArray(addressField.value)) {
                                return addressField.value.map((a) => a.address || a)
                              }
                              if (addressField.address) {
                                return [addressField.address]
                              }
                              return []
                            }

                            // Safely get sender name and email
                            let senderName = null
                            let senderEmail = null

                            if (parsed.from) {
                              if (Array.isArray(parsed.from)) {
                                senderName = parsed.from.map((a) => a.name || a.address).join(", ")
                                senderEmail = parsed.from.map((a) => a.address).join(", ")
                              } else if (parsed.from.value && Array.isArray(parsed.from.value)) {
                                senderName = parsed.from.value.map((a) => a.name || a.address).join(", ")
                                senderEmail = parsed.from.value.map((a) => a.address).join(", ")
                              } else if (parsed.from.name || parsed.from.address) {
                                senderName = parsed.from.name
                                senderEmail = parsed.from.address
                              } else if (parsed.from.text) {
                                // Parse "Name <email@domain.com>" format
                                const match = parsed.from.text.match(/^(.*?)\s*<(.+?)>$/)
                                if (match) {
                                  senderName = match[1].trim()
                                  senderEmail = match[2].trim()
                                } else {
                                  senderEmail = parsed.from.text.trim()
                                }
                              }
                            }

                            // Skip if no valid sender email
                            if (!senderEmail || senderEmail.trim() === "") {
                              console.warn("Skipping email insertion due to missing sender_email:", parsed.subject)
                              resolveFetch()
                              return
                            }

                            // Prepare email data for insertion
                            const emailData = {
                              user_id: userId,
                              sender: senderName || senderEmail,
                              sender_email: senderEmail,
                              to_recipients: getAddresses(parsed.to),
                              cc_recipients: getAddresses(parsed.cc),
                              bcc_recipients: getAddresses(parsed.bcc),
                              subject: parsed.subject || "No Subject",
                              body_text: parsed.text || null,
                              body_html: parsed.html || null,
                              preview: parsed.text ? parsed.text.substring(0, 100) : null,
                              sent_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
                              message_id:
                                parsed.messageId || `imap-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
                              unread: true,
                              starred: false,
                              is_archived: false,
                              is_trashed: false,
                              folder: "INBOX",
                              labels: [],
                              attachments: parsed.attachments
                                ? parsed.attachments.map((att) => ({
                                    name: att.filename || "attachment",
                                    size: att.size ? `${(att.size / 1024).toFixed(2)} KB` : "Unknown",
                                  }))
                                : [],
                              avatar_url: null,
                              initials: senderName
                                ? senderName.substring(0, 2).toUpperCase()
                                : senderEmail.substring(0, 2).toUpperCase(),
                              client_id: null,
                            }

                            const { data, error } = await supabaseAdmin.from("emails").insert([emailData])

                            if (error) {
                              console.error("Error inserting email into Supabase:", error)
                              // Don't reject on individual email errors, just log and continue
                              console.warn("Continuing with next email...")
                            } else {
                              console.log("Email inserted into Supabase successfully")
                            }

                            resolveFetch()
                          } catch (supabaseError) {
                            console.error("Supabase error during insertion:", supabaseError)
                            // Don't reject on individual email errors
                            resolveFetch()
                          }
                        })
                      })
                    })

                    f.once("error", (err) => {
                      console.error("Error fetching message:", err)
                      resolveFetch() // Continue with other emails
                    })

                    f.once("end", () => {
                      resolveFetch()
                    })
                  })
                })

                try {
                  await Promise.all(fetchPromises)
                  console.log(`Finished processing ${results.length} emails for user ${userId}`)

                  // Mark fetched emails as seen (optional - you might want to keep them unread)
                  imap.setFlags(results, ["\\Seen"], (err) => {
                    if (err) {
                      console.error("Error marking emails as read:", err)
                    } else {
                      console.log("Marked fetched emails as read.")
                    }
                    imap.end()
                    resolve()
                  })
                } catch (fetchError) {
                  console.error("Error processing emails:", fetchError)
                  imap.end()
                  resolve() // Don't reject, just resolve to continue with other users
                }
              } else {
                console.log("No new emails found for user", userId)
                imap.end()
                resolve()
              }
            })
          })
        } catch (error) {
          console.error("IMAP operation failed:", error)
          imap.end()
          reject(error)
        }
      })

      imap.once("error", (err) => {
        console.error("IMAP connection error:", err)
        reject(err)
      })

      imap.once("end", () => {
        console.log("IMAP connection ended for user", userId)
      })

      // Add timeout to prevent hanging connections
      const timeout = setTimeout(() => {
        console.log("IMAP connection timeout for user", userId)
        imap.end()
        reject(new Error("IMAP connection timeout"))
      }, 60000) // 60 second timeout

      imap.once("ready", () => {
        clearTimeout(timeout)
      })

      imap.once("end", () => {
        clearTimeout(timeout)
      })

      imap.connect()
    })
  } catch (error) {
    console.error("Error in fetchAndStoreEmails:", error)
    throw error // Re-throw to be handled by cron job
  }
}

async function getUserImapConfig(userId) {
  console.log(`getUserImapConfig called for userId: ${userId}`)
  const { data, error } = await supabaseAdmin.from("user_settings").select("*").eq("user_id", userId).single()

  if (error) {
    console.error("Error fetching IMAP config from user_settings:", error)
    return null
  }
  console.log("Fetched IMAP config for user:", userId)
  return data
}

module.exports = { connectImapAccount, fetchAndStoreEmails }
