// app/documents/editor/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorState, convertToRaw, convertFromRaw } from "draft-js";
import dynamic from "next/dynamic";
if (typeof window !== "undefined") {
  require("react-draft-wysiwyg/dist/react-draft-wysiwyg.css");
}
const Editor = dynamic(
  () => import("react-draft-wysiwyg").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
  }
);

import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css"; // Styles for the WYSIWYG editor
import { debounce } from "lodash"; // For debouncing save operations

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; // For change summary input
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import {
    Save,
    History,
    ChevronLeft,
    Signature,
    CheckSquare,
    Share2,
    Loader2,
    MoreHorizontal,
    XCircle,
    CheckCircle,
    FileText,
    Download,
    Mail,
    Plus,
    Upload,
} from "lucide-react";

// Utilities and Supabase
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Badge } from "@/components/ui/badge"; // Ensure Badge is imported

// Document interface
interface Document {
    id: number;
    user_id: string; // Creator of the document
    title: string;
    content: any | null; // JSONB for rich text
    created_at: string;
    updated_at: string;
    type: 'document' | 'approval';
    status: 'draft' | 'sent_for_signature' | 'signed' | 'sent_for_approval' | 'approved' | 'rejected' | 'archived';
    current_approver_id: string | null; // Stores email or user_id string
    current_signer_id: string | null;    // Stores email or user_id string
    shared_with: string[] | null;        // Array of user_id or email strings
    client_id: number | null; // Link to clients table
    client_name: string | null; // Denormalized client name
    creator_name?: string; // Denormalized or fetched separately
}

// Document Version interface
interface DocumentVersion {
    id: number;
    document_id: number;
    version_number: number;
    content: any; // Raw Draft.js ContentState JSON
    created_at: string;
    created_by_user_id: string; // The user ID who created this version
    change_summary?: string | null;
}

// Client interface for client selection dropdown
interface Client {
    id: number;
    name: string;
}

export default function DocumentEditorPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const documentId = params.id ? parseInt(params.id as string) : null;

    const [document, setDocument] = useState<Document | null>(null);
    const [editorState, setEditorState] = useState<EditorState>(EditorState.createEmpty());
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
    const [userId, setUserId] = useState<string | null>(null); // Current logged-in user ID
    const [userEmail, setUserEmail] = useState<string | null>(null); // Current logged-in user email
    const [isOwner, setIsOwner] = useState(false); // Flag if current user is the document owner
    const [canEdit, setCanEdit] = useState(false); // Flag if current user can edit

    // State for Modals
    const [openRequestSignatureModal, setOpenRequestSignatureModal] = useState(false);
    const [signerEmail, setSignerEmail] = useState("");

    const [openRequestApprovalModal, setOpenRequestApprovalModal] = useState(false);
    const [approverEmail, setApproverEmail] = useState("");

    const [openShareDocumentModal, setOpenShareDocumentModal] = useState(false);
    const [shareUserEmail, setShareUserEmail] = useState("");

    const [openSaveVersionModal, setOpenSaveVersionModal] = useState(false);
    const [changeSummary, setChangeSummary] = useState("");

    const [allClients, setAllClients] = useState<Client[]>([]);

    const isMounted = useRef(true); // Ref to track component mount status

    // Effect to get the current user's ID and fetch clients
    useEffect(() => {
        const fetchUserDataAndClients = async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error("Error getting Supabase user:", userError.message);
                toast({ title: "Authentication Error", description: "Failed to get user session.", variant: "destructive" });
                setUserId(null);
                setUserEmail(null);
            } else if (user) {
                setUserId(user.id);
                setUserEmail(user.email ?? null); // Store user email here with null fallback
            } else {
                setUserId(null);
                setUserEmail(null);
            }

            // Fetch all clients
            try {
                const { data: clientsData, error: clientsError } = await supabase
                    .from('clients')
                    .select('id, name')
                    .order('name', { ascending: true });

                if (clientsError) {
                    console.error("Error fetching all clients:", clientsError.message);
                    toast({ title: 'Error', description: `Failed to fetch clients: ${clientsError.message}`, variant: 'destructive' });
                } else {
                    setAllClients(clientsData as Client[]);
                }
            } catch (error: any) {
                console.error("An unexpected error occurred while fetching all clients:", error.message);
                toast({ title: 'Error', description: 'An unexpected error occurred while fetching all clients.', variant: 'destructive' });
            }
        };
        fetchUserDataAndClients();

        // Cleanup function for isMounted ref
        return () => {
            isMounted.current = false;
        };
    }, [toast]);


    const fetchDocumentAndVersions = useCallback(async () => {
        if (!documentId || !userId) { // Wait for userId to be resolved
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
                    toast({ title: "Document Not Found", description: "The document you are trying to edit does not exist.", variant: "destructive" });
                    router.push('/documents');
                    return;
                }
                throw docError;
            }

            // Determine ownership and editing permissions
            const isDocOwner = docData.user_id === userId;
            setIsOwner(isDocOwner);

            // Check if user is owner or if document is shared with them
            const isSharedWithUser = docData.shared_with && userId && docData.shared_with.includes(userId); // Check for UUID
            const isSharedWithUserEmail = docData.shared_with && userEmail && docData.shared_with.includes(userEmail); // Check for email

            // For now, allow editing only by owner. Could be extended for shared editing.
            setCanEdit(isDocOwner); // Only owner can edit, shared users can view only

            setDocument(docData as Document);

            // Initialize the editor with the document's content
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
            if (isMounted.current) { // Only set loading if component is still mounted
                setLoading(false);
            }
        }
    }, [documentId, userId, userEmail, toast, router]); // Added userEmail to dependency array


    // Fetch document and versions once userId is available
    useEffect(() => {
        if (documentId && userId !== null) { // userId being null means not authenticated, which will be handled by redirect
            fetchDocumentAndVersions();
        }
    }, [documentId, userId, fetchDocumentAndVersions]);


    // Debounced auto-save function
    const debouncedSave = useCallback(
        debounce(async (currentContent: any) => {
            if (!document || !userId || !canEdit) return; // Only save if document exists, user is logged in, and can edit

            setIsSaving(true);
            try {
                const { error } = await supabase
                    .from('documents')
                    .update({
                        content: currentContent,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', document.id)
                    .eq('user_id', userId); // Ensure only owner can update

                if (error) {
                    console.error("Error auto-saving document:", error.message);
                    toast({ title: 'Auto-save Failed', description: `Error: ${error.message}`, variant: 'destructive' });
                } else {
                    toast({ title: 'Auto-saved', description: 'Your changes have been saved.', duration: 2000 });
                }
            } catch (error: any) {
                console.error("An unexpected error occurred during auto-save:", error.message);
                toast({ title: 'Auto-save Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
            } finally {
                if (isMounted.current) { // Only set saving status if component is still mounted
                    setIsSaving(false);
                }
            }
        }, 1500), // Save after 1.5 seconds of inactivity
        [document, userId, canEdit, toast]
    );

    // Handle editor state changes for auto-save
    const onEditorStateChange = useCallback((newEditorState: EditorState) => {
        if (!canEdit) return; // Prevent changes if not allowed to edit
        setEditorState(newEditorState);
        const contentState = newEditorState.getCurrentContent();
        if (contentState.hasText() || contentState.getBlockMap().first().getLength() > 0) {
            debouncedSave(convertToRaw(contentState));
        }
    }, [debouncedSave, canEdit]);


    // Manual Save Version
    const handleSaveVersion = async () => {
        if (!document || !userId || !isOwner) {
            toast({ title: "Error", description: "Invalid request or not authorized to save version.", variant: "destructive" });
            return;
        }

        setIsSaving(true); // Indicate saving process
        try {
            const currentContent = convertToRaw(editorState.getCurrentContent());

            // Get next version number
            const { data: maxVersion, error: maxVersionError } = await supabase
                .from('document_versions')
                .select('version_number')
                .eq('document_id', document.id)
                .order('version_number', { ascending: false })
                .limit(1)
                .single();

            const nextVersionNumber = (maxVersion ? maxVersion.version_number : 0) + 1;

            // Insert new version
            const { error: versionError } = await supabase
                .from('document_versions')
                .insert([{
                    document_id: document.id,
                    version_number: nextVersionNumber,
                    content: currentContent,
                    created_by_user_id: userId,
                    change_summary: changeSummary.trim() || null,
                }]);

            if (versionError) throw versionError;

            // Also update the main document's content and updated_at
            const { error: documentUpdateError } = await supabase
                .from('documents')
                .update({
                    content: currentContent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', document.id)
                .eq('user_id', userId);

            if (documentUpdateError) throw documentUpdateError;

            toast({ title: 'Version Saved', description: `Document saved as Version ${nextVersionNumber}.` });
            setOpenSaveVersionModal(false);
            setChangeSummary("");
            fetchDocumentAndVersions(); // Re-fetch to update the versions list
        } catch (error: any) {
            console.error("Error saving document version:", error.message);
            toast({ title: 'Save Version Failed', description: `Error: ${error.message}`, variant: 'destructive' });
        } finally {
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };


    // Helper function to load a previous version's content into the editor (for viewing/restoring)
    const handleLoadVersion = useCallback((versionContent: any) => {
        try {
            const contentState = convertFromRaw(versionContent);
            setEditorState(EditorState.createWithContent(contentState));
            toast({ title: "Version Loaded", description: "Content from selected version is now displayed in the editor.", duration: 3000 });
        } catch (error: any) {
            console.error("Error loading version:", error.message);
            toast({ title: "Error loading version", description: "Could not load content from this version.", variant: "destructive" });
        }
    }, [toast]);


    // Handle requesting signature
    const handleRequestSignature = async () => {
        if (!userId || !document || !isOwner) {
            toast({ title: "Error", description: "Invalid request or not authorized.", variant: "destructive" });
            return;
        }
        if (!signerEmail.trim()) {
            toast({ title: "Validation Error", description: "Signer email cannot be empty.", variant: "destructive" });
            return;
        }
        const signerIdentifier = signerEmail; // For now, directly use email as signer_id.

        try {
            // Create a signature request
            const { error: signatureError } = await supabase
                .from('signatures')
                .insert([{
                    document_id: document.id,
                    signer_id: signerIdentifier,
                    requested_by_user_id: userId,
                    status: 'pending',
                }]);

            if (signatureError) throw signatureError;

            // Update document status and current_signer_id
            const { error: documentUpdateError } = await supabase
                .from('documents')
                .update({
                    status: 'sent_for_signature',
                    current_signer_id: signerIdentifier,
                })
                .eq('id', document.id)
                .eq('user_id', userId); // Ensure only owner can update

            if (documentUpdateError) throw documentUpdateError;

            toast({ title: 'Success', description: `Signature requested for "${document.title}" from ${signerEmail}.` });
            setOpenRequestSignatureModal(false);
            setSignerEmail("");
            fetchDocumentAndVersions(); // Re-fetch to update document status
        } catch (error: any) {
            console.error("Error requesting signature:", error.message);
            toast({ title: 'Request Signature Failed', description: `Error: ${error.message}`, variant: 'destructive' });
        }
    };

    // Handle requesting approval
    const handleRequestApproval = async () => {
        if (!userId || !document || !isOwner) {
            toast({ title: "Error", description: "Invalid request or not authorized.", variant: "destructive" });
            return;
        }
        if (!approverEmail.trim()) {
            toast({ title: "Validation Error", description: "Approver email cannot be empty.", variant: "destructive" });
            return;
        }
        const approverIdentifier = approverEmail; // Directly use email as ID

        try {
            // Create an approval request
            const { error: approvalError } = await supabase
                .from('approvals')
                .insert([{
                    document_id: document.id,
                    approver_id: approverIdentifier,
                    requested_by_user_id: userId,
                    status: 'pending',
                    approval_order: 1, // Assuming simple single-step approval for now
                }]);

            if (approvalError) throw approvalError;

            // Update document status and current_approver_id
            const { error: documentUpdateError } = await supabase
                .from('documents')
                .update({
                    status: 'sent_for_approval',
                    current_approver_id: approverIdentifier,
                })
                .eq('id', document.id)
                .eq('user_id', userId); // Ensure only owner can update

            if (documentUpdateError) throw documentUpdateError;

            toast({ title: 'Success', description: `Approval requested for "${document.title}" from ${approverEmail}.` });
            setOpenRequestApprovalModal(false);
            setApproverEmail("");
            fetchDocumentAndVersions(); // Re-fetch to update document status
        } catch (error: any) {
            console.error("Error requesting approval:", error.message);
            toast({ title: 'Request Approval Failed', description: `Error: ${error.message}`, variant: 'destructive' });
        }
    };

    // Handle sharing document
    const handleShareDocument = async () => {
        if (!userId || !document || !isOwner) {
            toast({ title: "Error", description: "Invalid request or not authorized.", variant: "destructive" });
            return;
        }
        if (!shareUserEmail.trim()) {
            toast({ title: "Validation Error", description: "User email to share with cannot be empty.", variant: "destructive" });
            return;
        }
        const userToShareWithIdentifier = shareUserEmail;

        const currentSharedWith = document.shared_with || [];
        if (currentSharedWith.includes(userToShareWithIdentifier)) {
            toast({ title: "Info", description: "Document already shared with this user.", variant: "default" });
            return;
        }

        try {
            const { error } = await supabase
                .from('documents')
                .update({ shared_with: [...currentSharedWith, userToShareWithIdentifier] })
                .eq('id', document.id)
                .eq('user_id', userId); // Only owner can share

            if (error) throw error;

            toast({ title: 'Success', description: `Document shared with ${shareUserEmail}.` });
            setOpenShareDocumentModal(false);
            setShareUserEmail("");
            fetchDocumentAndVersions(); // Re-fetch to update shared_with list
        } catch (error: any) {
            console.error("Error sharing document:", error.message);
            toast({ title: 'Share Document Failed', description: `Error: ${error.message}`, variant: 'destructive' });
        }
    };

    // Handle update document metadata (title, type, client)
    const handleUpdateDocumentMetadata = async (field: 'title' | 'type' | 'client_id' | 'client_name', value: string | number | null) => {
        if (!document || !isOwner) {
            toast({ title: "Error", description: "Not authorized to update metadata.", variant: "destructive" });
            return;
        }

        let updateData: Partial<Document> = { updated_at: new Date().toISOString() };
        if (field === 'title') {
            updateData.title = value as string;
        } else if (field === 'type') {
            updateData.type = value as 'document' | 'approval';
        } else if (field === 'client_id') {
            updateData.client_id = value as number | null;
            // When client_id changes, also update client_name
            const selectedClient = allClients.find(c => c.id === value);
            updateData.client_name = selectedClient ? selectedClient.name : null;
        }

        try {
            const { error } = await supabase
                .from('documents')
                .update(updateData)
                .eq('id', document.id)
                .eq('user_id', userId);

            if (error) throw error;

            toast({ title: 'Metadata Updated', description: `Document ${field} updated successfully.` });
            fetchDocumentAndVersions(); // Re-fetch to update local state
        } catch (error: any) {
            console.error("Error updating document metadata:", error.message);
            toast({ title: 'Update Failed', description: `Error updating document metadata: ${error.message}`, variant: 'destructive' });
        }
    };

    // Handle delete document
    const handleDeleteDocument = async () => {
        if (!document || !isOwner) {
            toast({ title: "Error", description: "Not authorized to delete document.", variant: "destructive" });
            return;
        }

        setIsSaving(true); // Temporarily use saving state for deletion feedback
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', document.id)
                .eq('user_id', userId);

            if (error) throw error;

            toast({ title: 'Document Deleted', description: `"${document.title}" has been deleted.` });
            router.push('/documents'); // Redirect to document list after deletion
        } catch (error: any) {
            console.error("Error deleting document:", error.message);
            toast({ title: 'Deletion Failed', description: `Error deleting document: ${error.message}`, variant: 'destructive' });
        } finally {
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };


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
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            {document.title}
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        </CardTitle>
                        <CardDescription className="flex items-center space-x-2">
                            <span>Last Updated: {formatDistanceToNowStrict(new Date(document.updated_at), { addSuffix: true })}</span>
                            <Badge variant={getStatusBadgeVariant(document.status)} className={`${getStatusBadgeColor(document.status)}`}>
                                {document.status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                            </Badge>
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" onClick={() => router.push('/documents')}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Documents
                        </Button>
                        {isOwner && (
                            <>
                                <Button onClick={() => setOpenSaveVersionModal(true)}>
                                    <Save className="mr-2 h-4 w-4" /> Save Version
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-9">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">More actions</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Document Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => { setSignerEmail(document.current_signer_id || ""); setOpenRequestSignatureModal(true); }}>
                                            <Signature className="mr-2 h-4 w-4" /> Request Signature
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setApproverEmail(document.current_approver_id || ""); setOpenRequestApprovalModal(true); }}>
                                            <CheckSquare className="mr-2 h-4 w-4" /> Request Approval
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setShareUserEmail(""); setOpenShareDocumentModal(true); }}>
                                            <Share2 className="mr-2 h-4 w-4" /> Share Document
                                        </DropdownMenuItem>
                                        {/* <DropdownMenuItem>
                                            <Download className="mr-2 h-4 w-4" /> Export to PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                            <Mail className="mr-2 h-4 w-4" /> Send Email
                                        </DropdownMenuItem> */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                    <XCircle className="mr-2 h-4 w-4" /> Delete Document
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete your
                                                        document and remove its data from our servers.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteDocument} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-6 h-full min-h-[calc(100vh-200px)]">
                    {/* Main Editor Area */}
                    <div className="flex-1 border rounded-md p-4 min-h-[500px] overflow-auto bg-gray-50 flex flex-col">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="doc-title">Title</Label>
                                <Input
                                    id="doc-title"
                                    value={document.title}
                                    onChange={(e) => setDocument(prev => prev ? { ...prev, title: e.target.value } : null)}
                                    onBlur={(e) => handleUpdateDocumentMetadata('title', e.target.value)}
                                    disabled={!isOwner}
                                />
                            </div>
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="doc-type">Type</Label>
                                <Select
                                    value={document.type}
                                    onValueChange={(value: 'document' | 'approval') => {
                                        setDocument(prev => prev ? { ...prev, type: value } : null);
                                        handleUpdateDocumentMetadata('type', value);
                                    }}
                                    disabled={!isOwner}
                                >
                                    <SelectTrigger id="doc-type">
                                        <SelectValue placeholder="Select document type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="document">Standard Document</SelectItem>
                                        <SelectItem value="approval">Approval Document</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="doc-client">Client</Label>
                                <Select
                                    value={document.client_id?.toString() || "none"}
                                    onValueChange={(value) => {
                                        const newClientId = value === "none" ? null : parseInt(value);
                                        const selectedClient = allClients.find(c => c.id === newClientId);
                                        setDocument(prev => prev ? { ...prev, client_id: newClientId, client_name: selectedClient?.name || null } : null);
                                        handleUpdateDocumentMetadata('client_id', newClientId);
                                    }}
                                    disabled={!isOwner}
                                >
                                    <SelectTrigger id="doc-client">
                                        <SelectValue placeholder="Select a client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {allClients.map(client => (
                                            <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[400px] border rounded-md overflow-hidden p-2">
                            <Editor
                                editorState={editorState}
                                onEditorStateChange={onEditorStateChange}
                                readOnly={!canEdit} // Disable editing if not authorized
                                wrapperClassName="editor-wrapper-class h-full flex flex-col"
                                editorClassName="editor-main-class flex-1 overflow-y-auto px-4 py-2"
                                toolbarClassName="editor-toolbar-class border-b bg-white"
                                placeholder="Start typing your document here..."
                            />
                        </div>
                    </div>

                    {/* Version History Sidebar */}
                    <Card className="w-full md:w-1/4 h-full md:max-h-[calc(100vh-160px)] flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center">
                                <History className="mr-2 h-5 w-5" /> Version History
                            </CardTitle>
                            <CardDescription>View and load previous versions.</CardDescription>
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
                                            {isOwner && ( // Only owner can load/restore versions
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleLoadVersion(version.content)}
                                                >
                                                    <Upload className="h-4 w-4 mr-1" /> Load
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="p-4 text-sm text-muted-foreground text-center">No versions available. Save a version to see history.</p>
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            {/* Request Signature Modal */}
            <AlertDialog open={openRequestSignatureModal} onOpenChange={setOpenRequestSignatureModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Request Signature</AlertDialogTitle>
                        <AlertDialogDescription>
                            Request a signature for "{document.title}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="signer-email" className="text-right">
                                Signer Email
                            </Label>
                            <Input
                                id="signer-email"
                                type="email"
                                value={signerEmail}
                                onChange={(e) => setSignerEmail(e.target.value)}
                                className="col-span-3"
                                placeholder="signer@example.com"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRequestSignature}>Send Request</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Request Approval Modal */}
            <AlertDialog open={openRequestApprovalModal} onOpenChange={setOpenRequestApprovalModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Request Approval</AlertDialogTitle>
                        <AlertDialogDescription>
                            Request approval for "{document.title}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="approver-email" className="text-right">
                                Approver Email
                            </Label>
                            <Input
                                id="approver-email"
                                type="email"
                                value={approverEmail}
                                onChange={(e) => setApproverEmail(e.target.value)}
                                className="col-span-3"
                                placeholder="approver@example.com"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRequestApproval}>Send Request</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Share Document Modal */}
            <AlertDialog open={openShareDocumentModal} onOpenChange={setOpenShareDocumentModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Share Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Share "{document.title}" with another user.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="share-user-email" className="text-right">
                                User Email
                            </Label>
                            <Input
                                id="share-user-email"
                                type="email"
                                value={shareUserEmail}
                                onChange={(e) => setShareUserEmail(e.target.value)}
                                className="col-span-3"
                                placeholder="user@example.com"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleShareDocument}>Share</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Save Version Modal */}
            <AlertDialog open={openSaveVersionModal} onOpenChange={setOpenSaveVersionModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Save New Version</AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter a brief summary for this document version.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="change-summary" className="text-right">
                                Summary
                            </Label>
                            <Textarea
                                id="change-summary"
                                value={changeSummary}
                                onChange={(e) => setChangeSummary(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g., 'Added new clause 3.1', 'Minor formatting changes'"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveVersion}>Save Version</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
