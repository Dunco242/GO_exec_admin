// app/documents/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorState, convertFromRaw } from "draft-js";
const Editor = dynamic(
  () => import("react-draft-wysiwyg").then((mod) => mod.Editor),
  { ssr: false }
);
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css"; // Styles for the WYSIWYG editor

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, History, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Utilities and Supabase
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNowStrict } from "date-fns";
import dynamic from "next/dynamic";

// Document interface (re-using the one from the main documents page)
interface Document {
    id: number;
    user_id: string;
    title: string;
    content: any | null; // JSONB for rich text
    created_at: string;
    updated_at: string;
    type: 'document' | 'approval';
    status: 'draft' | 'sent_for_signature' | 'signed' | 'sent_for_approval' | 'approved' | 'rejected' | 'archived';
    current_approver_id: string | null;
    current_signer_id: string | null;
    shared_with: string[] | null;
    client_id: number | null;
    client_name: string | null;
    creator_name?: string;
}

// Document Version interface (re-using from editor page)
interface DocumentVersion {
    id: number;
    document_id: number;
    version_number: number;
    content: any; // Raw Draft.js ContentState JSON
    created_at: string;
    created_by_user_id: string;
    change_summary?: string | null;
}

export default function DocumentViewerPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const documentId = params.id ? parseInt(params.id as string) : null;

    const [document, setDocument] = useState<Document | null>(null);
    const [editorState, setEditorState] = useState<EditorState>(EditorState.createEmpty());
    const [loading, setLoading] = useState(true);
    const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
    const [userId, setUserId] = useState<string | null>(null); // To check if current user is owner or shared_with

    // Effect to get the current user's ID
    useEffect(() => {
        const getUserId = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) {
                console.error("Error getting user:", error.message);
                setUserId(null);
            } else if (user) {
                setUserId(user.id);
            } else {
                setUserId(null);
            }
        };
        getUserId();
    }, []);


    const fetchDocumentAndVersions = useCallback(async () => {
        if (!documentId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch the main document
            const { data: docData, error: docError } = await supabase
                .from('documents')
                .select('*')
                .eq('id', documentId)
                .single();

            if (docError) {
                if (docError.code === 'PGRST116') { // Supabase error code for 'No rows found'
                    toast({ title: "Document Not Found", description: "The document you are trying to view does not exist.", variant: "destructive" });
                    router.push('/documents');
                    return;
                }
                throw docError;
            }

            // --- Access Control for Viewer ---
            // A user can view if they are the owner OR if the document is shared with them
            if (!userId) { // If user ID is not yet fetched, defer access check
                setDocument(docData as Document); // Temporarily set document to show loading or redirect later
                return;
            }
            if (docData.user_id !== userId && !(docData.shared_with && docData.shared_with.includes(userId))) {
                 // If not owner and not explicitly shared, check by email if userId is an email string
                 // This assumes userId fetched from auth.getUser() returns email if no UUID is available or desired.
                 // For true robust access control, userId should always be the UUID from auth.users.
                 const { data: { user } } = await supabase.auth.getUser();
                 if (docData.user_id !== userId && !(docData.shared_with && docData.shared_with.includes(userId) || docData.shared_with.includes(user?.email || ''))) {
                    toast({ title: "Access Denied", description: "You do not have permission to view this document.", variant: "destructive" });
                    router.push('/documents');
                    return;
                 }
            }
            // --- End Access Control ---


            setDocument(docData as Document);

            // Initialize the editor with the document's content (read-only)
            if (docData.content) {
                try {
                    const contentState = convertFromRaw(docData.content);
                    setEditorState(EditorState.createWithContent(contentState));
                } catch (parseError) {
                    console.error("Error parsing document content:", parseError);
                    toast({ title: "Content Error", description: "Could not parse document content. It might be corrupted.", variant: "destructive" });
                    setEditorState(EditorState.createEmpty());
                }
            } else {
                setEditorState(EditorState.createEmpty());
            }

            // Fetch document versions
            const { data: versionsData, error: versionsError } = await supabase
                .from('document_versions')
                .select('*')
                .eq('document_id', documentId)
                .order('version_number', { ascending: false });

            if (versionsError) throw versionsError;
            setDocumentVersions(versionsData as DocumentVersion[]);

        } catch (error: any) {
            console.error("Error fetching document data:", error.message);
            toast({
                title: "Error fetching document",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [documentId, userId, toast, router]); // Include userId in dependencies for the access control check

    useEffect(() => {
        if (documentId && userId !== null) { // Ensure userId has been resolved (either to a UUID or null)
            fetchDocumentAndVersions();
        }
    }, [documentId, userId, fetchDocumentAndVersions]);


    // Helper function to load a previous version's content into the viewer
    const handleViewVersion = useCallback((versionContent: any) => {
        try {
            const contentState = convertFromRaw(versionContent);
            setEditorState(EditorState.createWithContent(contentState));
            toast({ title: "Version Viewed", description: "Content from selected version is now displayed.", duration: 3000 });
        } catch (error: any) {
            console.error("Error loading version:", error.message);
            toast({ title: "Error loading version", description: "Could not load content from this version.", variant: "destructive" });
        }
    }, [toast]);

    // Helper function to determine badge variant based on document status
    const getStatusBadgeVariant = useCallback((status: Document['status']) => {
        switch (status) {
            case 'draft': return 'outline';
            case 'sent_for_signature': return 'secondary';
            case 'signed': return 'default';
            case 'sent_for_approval': return 'secondary';
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'archived': return 'outline';
            default: return 'outline';
        }
    }, []);

    // Helper function to determine badge color based on document status
    const getStatusBadgeColor = useCallback((status: Document['status']) => {
        switch (status) {
            case 'draft': return 'text-gray-500 border-gray-500';
            case 'sent_for_signature': return 'text-blue-500 border-blue-500';
            case 'signed': return 'text-green-500 border-green-500';
            case 'sent_for_approval': return 'text-purple-500 border-purple-500';
            case 'approved': return 'text-green-600 border-green-600';
            case 'rejected': return 'text-red-500 border-red-500';
            case 'archived': return 'text-gray-400 border-gray-400';
            default: return '';
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
                <p className="ml-3 text-lg text-gray-700">Loading document...</p>
            </div>
        );
    }

    if (!document) {
        // This case should ideally be handled by the router.push in fetchDocumentAndVersions
        // if the document is not found or access is denied. This is a fallback.
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6">
                <h1 className="text-2xl font-bold mb-4">Document Not Found</h1>
                <p className="text-muted-foreground mb-6">The document you are looking for does not exist or you do not have permission.</p>
                <Button onClick={() => router.push('/documents')}>Go to Document List</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8">
            <Card className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex flex-col space-y-1">
                        <CardTitle className="text-2xl font-bold">{document.title}</CardTitle>
                        <CardDescription className="flex items-center space-x-2">
                            <span>Last Updated: {formatDistanceToNowStrict(new Date(document.updated_at), { addSuffix: true })}</span>
                            <Badge variant={getStatusBadgeVariant(document.status)} className={`${getStatusBadgeColor(document.status)}`}>
                                {document.status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                            </Badge>
                        </CardDescription>
                    </div>
                    <div>
                        <Button onClick={() => router.push(`/documents/editor/${document.id}`)} variant="secondary">
                            <Edit className="mr-2 h-4 w-4" /> Edit Document
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-6 h-full">
                    {/* Main Viewer Area */}
                    <div className="flex-1 border rounded-md p-4 min-h-[500px] overflow-auto bg-gray-50">
                        <Editor
                            editorState={editorState}
                            readOnly={true} // Viewer is always read-only
                            wrapperClassName="viewer-wrapper-class"
                            editorClassName="viewer-editor-class"
                            toolbarHidden={true} // Hide toolbar in viewer
                        />
                    </div>

                    {/* Version History Sidebar */}
                    <Card className="w-full md:w-1/4 h-full md:max-h-[calc(100vh-160px)] flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Version History</CardTitle>
                            <CardDescription>View previous versions.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-auto p-0">
                            {documentVersions.length > 0 ? (
                                <ul className="divide-y divide-gray-100">
                                    {documentVersions.map((version) => (
                                        <li key={version.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-sm">Version {version.version_number}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Saved {formatDistanceToNowStrict(new Date(version.created_at), { addSuffix: true })} by {version.created_by_user_id}
                                                </p>
                                                {version.change_summary && (
                                                    <p className="text-xs text-muted-foreground italic">
                                                        "{version.change_summary}"
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewVersion(version.content)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" /> View
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="p-4 text-sm text-muted-foreground text-center">No versions available.</p>
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
}
