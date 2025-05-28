"use client"

import type React from "react"

import { useState, type ChangeEvent, useEffect, useCallback } from "react"
import {
  Search,
  Star,
  Trash2,
  Archive,
  Mail,
  Send,
  File,
  MoreHorizontal,
  ChevronDown,
  Paperclip,
  X,
  Settings,
  Inbox,
  RefreshCw,
  Plus,
  Reply,
  ReplyAll,
  Forward,
  Download,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Email interface - Updated to precisely match your Supabase schema
interface Email {
  id: number
  user_id: string | null
  sender: string
  sender_email: string
  subject: string
  preview: string | null
  sent_at: string
  unread: boolean
  starred: boolean
  is_archived: boolean
  is_trashed: boolean
  avatar_url: string | null
  initials: string | null
  folder: string
  labels: string[] | null
  attachments: { name: string; size: string }[] | null
  body_text: string | null
  body_html: string | null
  to_recipients: string[] | null
  cc_recipients: string[] | null
  bcc_recipients: string[] | null
  message_id: string | null
  client_id: string | null
}

// Email folder interface
interface EmailFolder {
  name: string
  icon: React.ElementType
  count: number
}

// Email labels
const displayLabels = [
  { name: "Work", color: "#2563eb" },
  { name: "Personal", color: "#059669" },
  { name: "Important", color: "#d97706" },
  { name: "Urgent", color: "#dc2626" },
  { name: "Meeting", color: "#7c3aed" },
  { name: "Finance", color: "#4f46e5" },
]

// Interface for composing a new email
interface ComposeEmailState {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  attachments: { name: string; size: string; file: File | null }[]
  client_id: string | null
}

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [openEmailModal, setOpenEmailModal] = useState(false)
  const [activeFolder, setActiveFolder] = useState("Inbox")
  const [openComposeModal, setOpenComposeModal] = useState(false)
  const [openImapConnectModal, setOpenImapConnectModal] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // State for IMAP connection details
  const [imapHost, setImapHost] = useState("")
  const [imapPort, setImapPort] = useState("993")
  const [imapUsername, setImapUsername] = useState("")
  const [imapPassword, setImapPassword] = useState("")
  const [imapUseTLS, setImapUseTLS] = useState(true)
  const [isConnectingImap, setIsConnectingImap] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>("")

  // State for logged-in user's info
  const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null)
  const [loggedInUserEmail, setLoggedInUserEmail] = useState<string | null>(null)
  const [loggedInUserInitials, setLoggedInUserInitials] = useState<string | null>(null)
  const [loggedInUserAvatar, setLoggedInUserAvatar] = useState<string | null>(null)

  // State for sorting
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0)
  const [emailsPerPage, setEmailsPerPage] = useState(15)
  const [totalEmailsCount, setTotalEmailsCount] = useState(0)

  const [composeEmail, setComposeEmail] = useState<ComposeEmailState>({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
    attachments: [],
    client_id: null,
  })

  // State for folders
  const [folders, setFolders] = useState<EmailFolder[]>([
    { name: "Inbox", icon: Inbox, count: 0 },
    { name: "Sent", icon: Send, count: 0 },
    { name: "Drafts", icon: File, count: 0 },
    { name: "Starred", icon: Star, count: 0 },
    { name: "Trash", icon: Trash2, count: 0 },
    { name: "Archive", icon: Archive, count: 0 },
  ])

  // Fetch emails from Supabase
  const fetchEmails = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        console.error("User not authenticated, cannot fetch emails.")
        toast({
          title: "Authentication Required",
          description: "Please sign in to view emails.",
          variant: "destructive",
        })
        setEmails([])
        setTotalEmailsCount(0)
        return
      }

      let query = supabase.from("emails").select("*", { count: "exact" }).eq("user_id", session.user.id)

      // Apply folder filter
      if (activeFolder === "Inbox") {
        query = query
          .filter("is_archived", "eq", false)
          .filter("is_trashed", "eq", false)
          .or("folder.eq.INBOX,folder.is.null")
      } else if (activeFolder === "Sent") {
        query = query.eq("folder", "SENT")
      } else if (activeFolder === "Drafts") {
        query = query.eq("folder", "DRAFTS")
      } else if (activeFolder === "Starred") {
        query = query.eq("starred", true).filter("is_archived", "eq", false).filter("is_trashed", "eq", false)
      } else if (activeFolder === "Trash") {
        query = query.eq("is_trashed", true)
      } else if (activeFolder === "Archive") {
        query = query.eq("is_archived", true)
      }

      // Apply search query filter
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase()
        query = query.or(
          `sender.ilike.%${lowerCaseQuery}%,sender_email.ilike.%${lowerCaseQuery}%,subject.ilike.%${lowerCaseQuery}%,body_text.ilike.%${lowerCaseQuery}%,body_html.ilike.%${lowerCaseQuery}%`,
        )
      }

      // Apply sorting
      query = query.order("sent_at", { ascending: sortOrder === "oldest" })

      // Apply pagination
      const from = currentPage * emailsPerPage
      const to = from + emailsPerPage - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching emails:", error)
        toast({
          title: "Error",
          description: "Failed to fetch emails from Supabase.",
          variant: "destructive",
        })
        setEmails([])
        setTotalEmailsCount(0)
        return
      }

      if (data) {
        const formattedEmails = data.map((email) => ({
          ...email,
          to_recipients: email.to_recipients || [],
          cc_recipients: email.cc_recipients || [],
          bcc_recipients: email.bcc_recipients || [],
          labels: email.labels || [],
          attachments: email.attachments || [],
          avatar_url: email.avatar_url || "/placeholder.svg",
          initials: email.initials || (email.sender ? email.sender.substring(0, 2).toUpperCase() : "?"),
          preview: email.preview || (email.body_text ? email.body_text.substring(0, 100) : ""),
        }))
        setEmails(formattedEmails as Email[])
        setTotalEmailsCount(count || 0)
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching emails:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching emails from Supabase.",
        variant: "destructive",
      })
    }
  }, [activeFolder, searchQuery, sortOrder, currentPage, emailsPerPage, toast])

  // Effect to fetch emails
  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  // Effect to update folder counts
  useEffect(() => {
    const fetchAllEmailsForCounts = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from("emails")
        .select("folder, starred, is_trashed, is_archived")
        .eq("user_id", session.user.id)

      if (error) {
        console.error("Error fetching all emails for counts:", error)
        return
      }

      const newFolderCounts = {
        Inbox: data.filter(
          (email) => !email.is_archived && !email.is_trashed && (email.folder === "INBOX" || email.folder === null),
        ).length,
        Sent: data.filter((email) => email.folder === "SENT").length,
        Drafts: data.filter((email) => email.folder === "DRAFTS").length,
        Starred: data.filter((email) => email.starred && !email.is_archived && !email.is_trashed).length,
        Trash: data.filter((email) => email.is_trashed).length,
        Archive: data.filter((email) => email.is_archived).length,
      }

      setFolders((prevFolders) =>
        prevFolders.map((folder) => ({
          ...folder,
          count: newFolderCounts[folder.name as keyof typeof newFolderCounts] || 0,
        })),
      )
    }
    fetchAllEmailsForCounts()
  }, [emails])

  // Effect to read URL parameters
  useEffect(() => {
    const to = searchParams.get("to") || ""
    const subject = searchParams.get("subject") || ""
    const body = searchParams.get("body") || ""
    const clientId = searchParams.get("client_id")

    if (to) {
      setComposeEmail({
        to: to,
        cc: "",
        bcc: "",
        subject: subject,
        body: body,
        attachments: [],
        client_id: clientId || null,
      })
      setOpenComposeModal(true)
    }
  }, [searchParams])

  // Effect to get logged-in user's information
  useEffect(() => {
    const getUserInfo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setLoggedInUserName(user.user_metadata?.full_name || user.email || "User")
        setLoggedInUserEmail(user.email || null)
        setLoggedInUserInitials(
          user.user_metadata?.full_name
            ? user.user_metadata.full_name.substring(0, 2).toUpperCase()
            : user.email
              ? user.email.substring(0, 2).toUpperCase()
              : "?",
        )
        setLoggedInUserAvatar(user.user_metadata?.avatar_url || null)
      }
    }
    getUserInfo()
  }, [])

  const handleComposeInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setComposeEmail((prev) => ({ ...prev, [id]: value }))
  }

  const handleAttachmentChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newAttachments = Array.from(e.target.files).map((file) => ({
        name: file.name,
        size: `${(file.size / 1024).toFixed(2)} KB`,
        file: file,
      }))
      setComposeEmail((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }))
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setComposeEmail((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  const handleSendEmail = async () => {
    const toArray = composeEmail.to
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email !== "")
    const ccArray = composeEmail.cc
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email !== "")
    const bccArray = composeEmail.bcc
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email !== "")

    if (toArray.length === 0 || !composeEmail.subject || !composeEmail.body) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least one recipient in 'To', Subject, and Body fields.",
        variant: "destructive",
      })
      return
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to send emails.",
          variant: "destructive",
        })
        return
      }

      const newEmailData = {
        user_id: session.user.id,
        sender: loggedInUserName || "Your Name",
        sender_email: loggedInUserEmail || "your.email@example.com",
        subject: composeEmail.subject,
        body_text: composeEmail.body,
        body_html: null,
        preview: composeEmail.body ? composeEmail.body.substring(0, 100) : null,
        to_recipients: toArray,
        cc_recipients: ccArray,
        bcc_recipients: bccArray,
        client_id: composeEmail.client_id,
        sent_at: new Date().toISOString(),
        unread: false,
        starred: false,
        folder: "SENT",
        labels: [],
        attachments: composeEmail.attachments.map((att) => ({
          name: att.name,
          size: att.size,
        })),
        message_id: `composed-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      }

      const { data, error } = await supabase.from("emails").insert([newEmailData])

      if (error) {
        console.error("Error sending email:", error)
        toast({
          title: "Error",
          description: "Failed to send email.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Email Sent!",
        description: `To: ${toArray.join(", ")}, Subject: ${composeEmail.subject}`,
        variant: "default",
      })

      setOpenComposeModal(false)
      setComposeEmail({
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
        attachments: [],
        client_id: null,
      })
      fetchEmails()
    } catch (error) {
      console.error("An unexpected error occurred while sending email:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while sending email.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateEmailStatus = async (emailId: number, updates: Partial<Email>, showToast = true) => {
    try {
      const { error } = await supabase.from("emails").update(updates).eq("id", emailId)

      if (error) {
        console.error("Error updating email status:", error)
        if (showToast) {
          toast({
            title: "Error",
            description: "Failed to update email status.",
            variant: "destructive",
          })
        }
        return
      }
      if (showToast) {
        toast({ title: "Success", description: "Email updated successfully." })
      }
      fetchEmails()

      // Update the selected email if it's the one being updated
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail((prev) => (prev ? { ...prev, ...updates } : null))
      }
    } catch (error) {
      console.error("An unexpected error occurred while updating email status:", error)
      if (showToast) {
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDeleteEmail = async (emailId: number) => {
    try {
      const { error } = await supabase.from("emails").update({ is_trashed: true, folder: "TRASH" }).eq("id", emailId)

      if (error) {
        console.error("Error moving email to trash:", error)
        toast({
          title: "Error",
          description: "Failed to move email to trash.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Success",
        description: "Email moved to trash successfully.",
      })
      fetchEmails()
      setOpenEmailModal(false)
      setSelectedEmail(null)
    } catch (error) {
      console.error("An unexpected error occurred while moving email to trash:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const handleStarEmail = (email: Email) => {
    handleUpdateEmailStatus(email.id, { starred: !email.starred })
  }

  const handleArchiveEmail = (email: Email) => {
    handleUpdateEmailStatus(email.id, { is_archived: true, folder: "ARCHIVE" })
    setOpenEmailModal(false)
    setSelectedEmail(null)
  }

  const handleMarkAsRead = (email: Email) => {
    if (email.unread) {
      handleUpdateEmailStatus(email.id, { unread: false }, false)
    }
  }

  const handleConnectImap = async () => {
    setIsConnectingImap(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error("User not authenticated")
      }

      const response = await fetch("/api/connect-imap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          host: imapHost,
          port: Number.parseInt(imapPort),
          username: imapUsername,
          password: imapPassword,
          tls: imapUseTLS,
          user_id: session.user.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to connect to IMAP server")
      }

      toast({
        title: "IMAP Connection Successful!",
        description: "Emails are now being synced to your inbox.",
        variant: "default",
      })
      setOpenImapConnectModal(false)
      await fetchEmails()
    } catch (error: any) {
      console.error("IMAP Connection Error:", error.message || error)
      toast({
        title: "IMAP Connection Failed",
        description: error.message || "Could not connect to the IMAP server",
        variant: "destructive",
      })
    } finally {
      setIsConnectingImap(false)
    }
  }

  const handleOpenEmail = useCallback(
    async (emailToOpen: Email) => {
      setSelectedEmail(emailToOpen)
      setOpenEmailModal(true)

      // If full body_text or body_html is missing, fetch it
      if (!emailToOpen.body_text && !emailToOpen.body_html) {
        try {
          const { data: fullEmailData, error: fetchError } = await supabase
            .from("emails")
            .select("*")
            .eq("id", emailToOpen.id)
            .single()

          if (fetchError) {
            console.error("Error fetching full email content:", fetchError)
            toast({
              title: "Error",
              description: "Failed to load full email content.",
              variant: "destructive",
            })
            return
          }

          if (fullEmailData) {
            setSelectedEmail(fullEmailData as Email)
          }
        } catch (error) {
          console.error("An unexpected error occurred while fetching full email:", error)
          toast({
            title: "Error",
            description: "An unexpected error occurred while loading full email content.",
            variant: "destructive",
          })
        }
      }

      // Mark as read if it was unread
      if (emailToOpen.unread) {
        handleMarkAsRead(emailToOpen)
      }
    },
    [toast],
  )

  const handleReplyClick = useCallback((email: Email) => {
    setComposeEmail({
      to: email.sender_email,
      cc: "",
      bcc: "",
      subject: `Re: ${email.subject || ""}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.sender} <${email.sender_email}>\nDate: ${format(new Date(email.sent_at), "MMM d,yyyy, h:mm a")}\nSubject: ${email.subject}\nTo: ${email.to_recipients?.join(", ") || ""}\n\n${email.body_text || ""}`,
      attachments: [],
      client_id: email.client_id,
    })
    setOpenEmailModal(false)
    setOpenComposeModal(true)
  }, [])

  const handleReplyAllClick = useCallback(
    (email: Email) => {
      const allRecipients = [email.sender_email, ...(email.to_recipients || []), ...(email.cc_recipients || [])].filter(
        (addr, index, self) => addr !== loggedInUserEmail && self.indexOf(addr) === index,
      )

      setComposeEmail({
        to: allRecipients.join(", "),
        cc: "",
        bcc: "",
        subject: `Re: ${email.subject || ""}`,
        body: `\n\n--- Original Message ---\nFrom: ${email.sender} <${email.sender_email}>\nDate: ${format(new Date(email.sent_at), "MMM d,yyyy, h:mm a")}\nSubject: ${email.subject}\nTo: ${email.to_recipients?.join(", ") || ""}\n\n${email.body_text || ""}`,
        attachments: [],
        client_id: email.client_id,
      })
      setOpenEmailModal(false)
      setOpenComposeModal(true)
    },
    [loggedInUserEmail],
  )

  const handleForwardClick = useCallback((email: Email) => {
    setComposeEmail({
      to: "",
      cc: "",
      bcc: "",
      subject: `Fwd: ${email.subject || ""}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.sender} <${email.sender_email}>\nDate: ${format(new Date(email.sent_at), "MMM d,yyyy, h:mm a")}\nSubject: ${email.subject}\nTo: ${email.to_recipients?.join(", ") || ""}\n\n${email.body_text || ""}`,
      attachments: [],
      client_id: email.client_id,
    })
    setOpenEmailModal(false)
    setOpenComposeModal(true)
  }, [])

  // Calculate total pages
  const totalPages = Math.ceil(totalEmailsCount / emailsPerPage)

  // Handle page change
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mail</h1>
            <Button
              onClick={() => setOpenComposeModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Compose
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search emails..."
              className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value)
                setCurrentPage(0)
              }}
            />
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={loggedInUserAvatar || "/placeholder.svg"} alt={loggedInUserName || "User"} />
              <AvatarFallback className="bg-blue-100 text-blue-600">{loggedInUserInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{loggedInUserName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{loggedInUserEmail}</p>
            </div>
          </div>
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="space-y-1">
              {folders.map((folder) => (
                <Button
                  key={folder.name}
                  variant={activeFolder === folder.name ? "secondary" : "ghost"}
                  className={`w-full justify-start h-10 ${
                    activeFolder === folder.name
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => {
                    setActiveFolder(folder.name)
                    setCurrentPage(0)
                  }}
                >
                  <folder.icon className="mr-3 h-4 w-4" />
                  <span className="flex-1 text-left">{folder.name}</span>
                  {folder.count > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                    >
                      {folder.count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Labels */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Labels</h3>
              <div className="space-y-2">
                {displayLabels.map((label) => (
                  <div key={label.name} className="flex items-center">
                    <div className="mr-3 h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{label.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Settings */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700 dark:text-gray-300"
                onClick={() => setOpenImapConnectModal(true)}
              >
                <Settings className="mr-3 h-4 w-4" />
                IMAP Settings
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={async () => {
                  const { error } = await supabase.auth.signOut()
                  if (error) {
                    console.error("Error logging out:", error)
                    toast({
                      title: "Error",
                      description: "Failed to log out.",
                      variant: "destructive",
                    })
                  } else {
                    toast({
                      title: "Logged Out",
                      description: "You have been successfully logged out.",
                      variant: "default",
                    })
                  }
                }}
              >
                <X className="mr-3 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width Email List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeFolder}</h2>
              <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                {totalEmailsCount} emails
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchEmails()}
                className="text-gray-600 dark:text-gray-400"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      emails.forEach((email) => {
                        if (email.unread) {
                          handleUpdateEmailStatus(email.id, { unread: false }, false)
                        }
                      })
                      toast({
                        title: "Success",
                        description: "All visible emails marked as read.",
                        variant: "default",
                      })
                    }}
                  >
                    Mark All As Read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fetchEmails()}>Refresh List</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setSortOrder("newest")
                      setCurrentPage(0)
                    }}
                  >
                    Newest First {sortOrder === "newest" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSortOrder("oldest")
                      setCurrentPage(0)
                    }}
                  >
                    Oldest First {sortOrder === "oldest" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Email List - Full Width */}
        <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden">
          <ScrollArea className="h-full">
            {emails.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-6 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      email.unread ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-750"
                    }`}
                    onClick={() => handleOpenEmail(email)}
                  >
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={email.avatar_url || "/placeholder.svg"} alt={email.sender} />
                        <AvatarFallback className="bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                          {email.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <p
                              className={`text-base truncate ${
                                email.unread
                                  ? "font-semibold text-gray-900 dark:text-white"
                                  : "font-medium text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {email.sender}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{email.sender_email}</p>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {email.starred && <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(email.sent_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                        </div>
                        <p
                          className={`text-lg mb-2 truncate ${
                            email.unread
                              ? "font-semibold text-gray-900 dark:text-white"
                              : "font-medium text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {email.subject}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{email.preview}</p>
                        {email.labels && email.labels.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {displayLabels.map((labelData) => {
                              if (email.labels?.includes(labelData.name)) {
                                return (
                                  <div
                                    key={labelData.name}
                                    className="text-xs px-3 py-1 rounded-full font-medium"
                                    style={{
                                      backgroundColor: `${labelData.color}20`,
                                      color: labelData.color,
                                    }}
                                  >
                                    {labelData.name}
                                  </div>
                                )
                              }
                              return null
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <Mail className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No emails in this folder.</p>
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
                className="text-gray-600 dark:text-gray-400"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage + 1} of {totalPages === 0 ? 1 : totalPages}
              </span>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1 || totalPages === 0}
                className="text-gray-600 dark:text-gray-400"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Detail Modal */}
      <Dialog open={openEmailModal} onOpenChange={setOpenEmailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {selectedEmail?.subject || "Email"}
                </DialogTitle>
                {selectedEmail && (
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedEmail.avatar_url || "/placeholder.svg"} alt={selectedEmail.sender} />
                      <AvatarFallback className="bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                        {selectedEmail.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedEmail.sender}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEmail.sender_email}</p>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(selectedEmail.sent_at), "MMM d, yyyy, h:mm a")}
                        </p>
                      </div>
                      {selectedEmail.to_recipients && selectedEmail.to_recipients.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          To: {selectedEmail.to_recipients.join(", ")}
                        </p>
                      )}
                      {selectedEmail.cc_recipients && selectedEmail.cc_recipients.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Cc: {selectedEmail.cc_recipients.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {selectedEmail && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStarEmail(selectedEmail)}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      <Star className={`h-4 w-4 ${selectedEmail.starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchiveEmail(selectedEmail)}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEmail(selectedEmail.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenEmailModal(false)}
                  className="text-gray-600 dark:text-gray-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Email Body - Scrollable Content */}
          <div className="flex-1 min-h-0 max-h-[calc(90vh-200px)] overflow-y-auto p-6">
            {selectedEmail && (
              <>
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedEmail.body_html || selectedEmail.body_text || "",
                  }}
                />

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Attachments ({selectedEmail.attachments.length})
                    </h3>
                    <div className="grid gap-3">
                      {selectedEmail.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <File className="h-6 w-6 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{attachment.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{attachment.size}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            {selectedEmail && (
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => handleReplyClick(selectedEmail)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReplyAllClick(selectedEmail)}
                  className="text-gray-600 dark:text-gray-400"
                >
                  <ReplyAll className="h-4 w-4 mr-2" />
                  Reply All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleForwardClick(selectedEmail)}
                  className="text-gray-600 dark:text-gray-400"
                >
                  <Forward className="h-4 w-4 mr-2" />
                  Forward
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Email Modal */}
      <Dialog open={openComposeModal} onOpenChange={setOpenComposeModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compose New Email</DialogTitle>
            <DialogDescription>Fill in the details to send a new email.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To
              </Label>
              <Input
                id="to"
                value={composeEmail.to}
                onChange={handleComposeInputChange}
                className="col-span-3"
                placeholder="recipient1@example.com, recipient2@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cc" className="text-right">
                Cc
              </Label>
              <Input
                id="cc"
                value={composeEmail.cc}
                onChange={handleComposeInputChange}
                className="col-span-3"
                placeholder="cc1@example.com, cc2@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bcc" className="text-right">
                Bcc
              </Label>
              <Input
                id="bcc"
                value={composeEmail.bcc}
                onChange={handleComposeInputChange}
                className="col-span-3"
                placeholder="bcc1@example.com, bcc2@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Input
                id="subject"
                value={composeEmail.subject}
                onChange={handleComposeInputChange}
                className="col-span-3"
                placeholder="Email Subject"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="body" className="text-right">
                Body
              </Label>
              <Textarea
                id="body"
                value={composeEmail.body}
                onChange={handleComposeInputChange}
                className="col-span-3 min-h-[200px]"
                placeholder="Write your email here..."
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="attachments" className="text-right">
                Attachments
              </Label>
              <div className="col-span-3">
                <Input id="attachments" type="file" multiple onChange={handleAttachmentChange} className="col-span-3" />
                <div className="mt-2 space-y-2">
                  {composeEmail.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {attachment.name} ({attachment.size})
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveAttachment(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpenComposeModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={isConnectingImap}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IMAP Connection Modal */}
      <Dialog open={openImapConnectModal} onOpenChange={setOpenImapConnectModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Connect IMAP Account</DialogTitle>
            <DialogDescription>Enter your IMAP server details to sync your emails.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imapHost" className="text-right">
                IMAP Host
              </Label>
              <Input
                id="imapHost"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                className="col-span-3"
                placeholder="imap.gmail.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imapPort" className="text-right">
                Port
              </Label>
              <Input
                id="imapPort"
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value)}
                className="col-span-3"
                placeholder="993"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imapUsername" className="text-right">
                Username
              </Label>
              <Input
                id="imapUsername"
                value={imapUsername}
                onChange={(e) => setImapUsername(e.target.value)}
                className="col-span-3"
                placeholder="your_email@gmail.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imapPassword" className="text-right">
                Password
              </Label>
              <Input
                id="imapPassword"
                type="password"
                value={imapPassword}
                onChange={(e) => setImapPassword(e.target.value)}
                className="col-span-3"
                placeholder="Your app password"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imapUseTLS" className="text-right">
                Use TLS
              </Label>
              <input
                id="imapUseTLS"
                type="checkbox"
                checked={imapUseTLS}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setImapUseTLS(e.target.checked)}
                className="col-span-3 h-4 w-4"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpenImapConnectModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConnectImap}
              disabled={isConnectingImap}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isConnectingImap ? "Connecting..." : "Connect & Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
