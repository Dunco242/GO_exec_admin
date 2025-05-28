"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import DocumentEditor from "../../../components/document-editor"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface Document {
  id: number
  user_id: string
  title: string
  content: string // HTML string from TipTap
  created_at: string
  updated_at: string
  type: "document" | "approval"
  status: "draft" | "sent_for_signature" | "signed" | "sent_for_approval" | "approved" | "rejected" | "archived"
  current_approver_id: string | null
  current_signer_id: string | null
  shared_with: string[] | null
  client_id: number | null
  client_name: string | null
}

interface DocumentEditorPageProps {
  params: Promise<{
    id: string // The document ID from the URL
  }>
}

export default function DocumentEditorPage({ params }: DocumentEditorPageProps) {
  // Unwrap the params Promise using React.use()
  const { id: documentId } = React.use(params)

  const router = useRouter()
  const { toast } = useToast()

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("edit")

  // Fetch user ID on component mount
  useEffect(() => {
    const getSupabaseUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getSupabaseUser()
  }, [])

  // Fetch document content
  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId || !userId) return // Wait for documentId and userId

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("id", Number.parseInt(documentId))
          .eq("user_id", userId) // Ensure user owns the document
          .single()

        if (error) {
          console.error("Error fetching document:", error.message || error)
          toast({
            title: "Error",
            description: `Failed to load document: ${error.message || "Unknown error"}`,
            variant: "destructive",
          })
          setDocument(null)
        } else if (data) {
          setDocument(data as Document)
        } else {
          toast({
            title: "Not Found",
            description: "Document not found or you do not have permission to view it.",
            variant: "destructive",
          })
          setDocument(null)
        }
      } catch (error: any) {
        console.error("An unexpected error occurred while fetching document:", error.message || error)
        toast({
          title: "Error",
          description: "An unexpected error occurred while loading the document.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId, userId, toast]) // Re-fetch when documentId or userId changes

  const handleSaveContent = useCallback(
    async (content: string) => {
      if (!document || !userId) {
        toast({ title: "Error", description: "Document not loaded or user not authenticated.", variant: "destructive" })
        return
      }

      setIsSaving(true)
      try {
        const { error } = await supabase
          .from("documents")
          .update({ content: content, updated_at: new Date().toISOString() })
          .eq("id", document.id)
          .eq("user_id", userId) // Ensure user owns the document

        if (error) {
          console.error("Error saving document content:", error.message || error)
          toast({
            title: "Error",
            description: `Failed to save document: ${error.message || "Unknown error"}`,
            variant: "destructive",
          })
        } else {
          toast({ title: "Success", description: "Document saved successfully!", variant: "default" })
          // Update local state to reflect new content and updated_at
          setDocument((prev) => (prev ? { ...prev, content: content, updated_at: new Date().toISOString() } : null))
        }
      } catch (error: any) {
        console.error("An unexpected error occurred while saving document:", error.message || error)
        toast({
          title: "Error",
          description: "An unexpected error occurred while saving the document.",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    },
    [document, userId, toast],
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#2660ff] mb-4" />
        <p className="text-lg text-muted-foreground">Loading document...</p>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg text-red-500 mb-4">Document not found or access denied.</p>
        <Button onClick={() => router.push("/documents")} className="bg-[#2660ff] hover:bg-[#1a4cd1]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Documents
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push("/documents")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Documents
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">{document.title}</h2>
        <div></div> {/* Spacer for right alignment */}
      </div>

      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value)}>
        <div className="flex justify-center mb-4">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="edit">
          <DocumentEditor
            initialContent={document.content || ""}
            onSave={handleSaveContent}
            isSaving={isSaving}
            isReadOnly={false} // Editor is editable in "edit" tab
          />
        </TabsContent>
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Document Preview</CardTitle>
              <CardDescription>Read-only view of your document.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="prose dark:prose-invert max-w-none p-4 border rounded-md"
                dangerouslySetInnerHTML={{ __html: document.content || "<p>No content to preview.</p>" }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
