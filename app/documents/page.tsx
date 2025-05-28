"use client";

import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { Plus, Search, FileText, Signature, CheckSquare, MoreHorizontal, Edit, Trash2, Share2, Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileNav } from "@/components/mobile-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Badge } from "@/components/ui/badge"; // Ensure Badge is imported
import { useRouter } from 'next/navigation'; // Import useRouter for navigation

// Document interface matching Supabase schema
interface Document {
    id: number;
    user_id: string; // Creator of the document
    title: string;
    content: any | null; // JSONB for rich text, 'any' for now
    created_at: string;
    updated_at: string;
    type: 'document' | 'approval';
    status: 'draft' | 'sent_for_signature' | 'signed' | 'sent_for_approval' | 'approved' | 'rejected' | 'archived';
    current_approver_id: string | null;
    current_signer_id: string | null;
    shared_with: string[] | null;
    client_id: number | null; // Link to clients table
    client_name: string | null; // Denormalized client name
    creator_name?: string; // Denormalized or fetched separately (now will be 'Unknown User' without join)
}

// Client interface for client selection dropdown
interface Client {
    id: number;
    name: string;
}

// UserProfile interface (now simplified as we are not fetching all users dynamically here)
interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
}

export default function DocumentManagementPage() {
    const { toast } = useToast();
    const router = useRouter(); // Initialize useRouter
    const [userId, setUserId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<string>("my-documents"); // 'my-documents', 'shared-with-me', 'pending-signatures', 'pending-approvals'

    // State for Create Document Modal
    const [openCreateDocumentModal, setOpenCreateDocumentModal] = useState(false);
    const [newDocumentTitle, setNewDocumentTitle] = useState("");
    const [newDocumentType, setNewDocumentType] = useState<'document' | 'approval'>('document');
    const [newDocumentClientId, setNewDocumentClientId] = useState<number | null>(null);
    const [newDocumentClientName, setNewDocumentClientName] = useState<string | null>(null);

    // State for Request Signature Modal
    const [openRequestSignatureModal, setOpenRequestSignatureModal] = useState(false);
    const [selectedDocumentForSignature, setSelectedDocumentForSignature] = useState<Document | null>(null);
    const [signerEmail, setSignerEmail] = useState("");

    // State for Request Approval Modal
    const [openRequestApprovalModal, setOpenRequestApprovalModal] = useState(false);
    const [selectedDocumentForApproval, setSelectedDocumentForApproval] = useState<Document | null>(null);
    const [approverEmail, setApproverEmail] = useState("");

    // State for Share Document Modal
    const [openShareDocumentModal, setOpenShareDocumentModal] = useState(false);
    const [selectedDocumentForShare, setSelectedDocumentForShare] = useState<Document | null>(null);
    const [shareUserEmail, setShareUserEmail] = useState("");

    // Data for dropdowns (allUsers will be empty as we are not fetching all users directly from auth.users)
    const [allClients, setAllClients] = useState<Client[]>([]); // For client selection
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]); // This will remain empty or contain only current user if needed

    // Fetch user ID and all clients on component mount
    useEffect(() => {
        const fetchDataForModals = async () => {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error("Error getting Supabase user:", userError.message || userError);
                toast({ title: "Authentication Error", description: "Failed to get user session.", variant: "destructive" });
                setUserId(null);
            } else if (user) {
                setUserId(user.id);
                // We are intentionally NOT fetching all users from auth.users here
                // as direct client-side querying of auth.users for a list is problematic
                // without a user_profiles table or custom RPC.
                // The 'allUsers' state will remain empty, and user emails for modals
                // will need to be manually typed.
                setAllUsers([]); // Ensure allUsers is empty
            } else {
                setUserId(null);
            }

            // Fetch all clients
            try {
                const { data: clientsData, error: clientsError } = await supabase
                    .from('clients')
                    .select('id, name')
                    .order('name', { ascending: true });

                if (clientsError) {
                    console.error("Error fetching all clients:", clientsError.message || clientsError);
                    toast({ title: 'Error', description: `Failed to fetch clients: ${clientsError.message || 'Unknown error'}`, variant: 'destructive' });
                } else {
                    setAllClients(clientsData as Client[]);
                }
            } catch (error: any) {
                console.error("An unexpected error occurred while fetching all clients:", error.message || error);
                toast({ title: 'Error', description: 'An unexpected error occurred while fetching all clients.', variant: 'destructive' });
            }
        };
        fetchDataForModals();
    }, [toast]);

    // Fetch documents based on active tab, user ID, and search term
    const fetchDocuments = useCallback(async () => {
        if (!userId) {
            setDocuments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let query = supabase
                .from('documents')
                .select(`*`); // Removed direct join with 'users' to avoid schema relationship error

            // Apply tab filters
            if (activeTab === 'my-documents') {
                query = query.eq('user_id', userId);
            } else if (activeTab === 'shared-with-me') {
                query = query.contains('shared_with', [userId]);
            } else if (activeTab === 'pending-signatures') {
                query = query.eq('current_signer_id', userId).eq('status', 'sent_for_signature');
            } else if (activeTab === 'pending-approvals') {
                query = query.eq('current_approver_id', userId).eq('status', 'sent_for_approval');
            }

            // Apply search term filter for title and client_name
            if (searchTerm) {
                const lowerCaseSearchTerm = searchTerm.toLowerCase();
                // Using .or() for multiple conditions
                query = query.or(`title.ilike.%${lowerCaseSearchTerm}%,client_name.ilike.%${lowerCaseSearchTerm}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching documents:", error.message || error.details || error);
                toast({ title: 'Error', description: `Failed to fetch documents: ${error.message || 'Unknown error'}`, variant: 'destructive' });
                setDocuments([]);
            } else {
                // Since we removed the join, creator_name will not be automatically available.
                // It will be 'Unknown User' or you can add a 'creator_email' field to Document interface
                // and display doc.user_id if needed.
                const formattedDocuments = data.map(doc => ({
                    ...doc,
                    creator_name: 'Unknown User', // Default as we are not joining auth.users
                }));
                setDocuments(formattedDocuments as Document[]);
            }
        } catch (error: any) {
            console.error("An unexpected error occurred while fetching documents:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred while fetching documents.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [userId, activeTab, searchTerm, toast]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Handle creating a new document
    const handleCreateDocument = async () => {
        if (!userId) {
            toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
            return;
        }
        if (!newDocumentTitle.trim()) {
            toast({ title: "Validation Error", description: "Document title cannot be empty.", variant: "destructive" });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('documents')
                .insert([{
                    user_id: userId,
                    title: newDocumentTitle,
                    type: newDocumentType,
                    status: 'draft',
                    content: '', // Initialize with empty string for TipTap HTML content
                    shared_with: [],
                    client_id: newDocumentClientId, // Include client ID
                    client_name: newDocumentClientName, // Include client name
                }])
                .select();

            if (error) {
                console.error("Error creating document:", error.message || error);
                toast({ title: 'Error', description: `Failed to create document: ${error.message || 'Unknown error'}`, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: `Document "${newDocumentTitle}" created.` });
                setOpenCreateDocumentModal(false);
                setNewDocumentTitle("");
                setNewDocumentType('document');
                setNewDocumentClientId(null);
                setNewDocumentClientName(null);
                fetchDocuments(); // Re-fetch to update list
                // Redirect to the new document's editor page
                if (data && data.length > 0) {
                    router.push(`/documents/editor/${data[0].id}`);
                }
            }
        } catch (error: any) {
            console.error("An unexpected error occurred while creating document:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
        }
    };

    // Handle redirecting to document editor/viewer
    const handleViewOrEditDocument = (docId: number) => {
        router.push(`/documents/editor/${docId}`);
    };

    // Handle requesting signature
    const handleRequestSignature = async () => {
        if (!userId || !selectedDocumentForSignature) {
            toast({ title: "Error", description: "Invalid request.", variant: "destructive" });
            return;
        }
        // Removed allUsers.find() as allUsers will be empty.
        // Assuming signerEmail is the actual user ID or email to be used.
        // In a real app, you'd validate this email against your registered users on the backend.
        const signerId = signerEmail; // For now, directly use email as ID for simplicity (requires backend mapping)

        try {
            // Create a signature request
            const { error: signatureError } = await supabase
                .from('signatures')
                .insert([{
                    document_id: selectedDocumentForSignature.id,
                    signer_id: signerId, // Use the provided signer email/ID
                    requested_by_user_id: userId,
                    status: 'pending',
                }]);

            if (signatureError) {
                console.error("Error creating signature request:", signatureError.message || signatureError);
                toast({ title: 'Error', description: `Failed to create signature request: ${signatureError.message || 'Unknown error'}`, variant: 'destructive' });
                return;
            }

            // Update document status and current_signer_id
            const { error: documentUpdateError } = await supabase
                .from('documents')
                .update({
                    status: 'sent_for_signature',
                    current_signer_id: signerId, // Use the provided signer email/ID
                })
                .eq('id', selectedDocumentForSignature.id)
                .eq('user_id', userId); // Ensure only owner can update

            if (documentUpdateError) {
                console.error("Error updating document status for signature:", documentUpdateError.message || documentUpdateError);
                toast({ title: 'Error', description: `Failed to update document status: ${documentUpdateError.message || 'Unknown error'}`, variant: 'destructive' });
                // Consider rolling back signature request if document update fails
                return;
            }

            toast({ title: 'Success', description: `Signature requested for "${selectedDocumentForSignature.title}" from ${signerEmail}.` });
            setOpenRequestSignatureModal(false);
            setSignerEmail("");
            fetchDocuments(); // Re-fetch to update list
        } catch (error: any) {
            console.error("An unexpected error occurred while requesting signature:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
        }
    };

    // Handle requesting approval
    const handleRequestApproval = async () => {
        if (!userId || !selectedDocumentForApproval) {
            toast({ title: "Error", description: "Invalid request.", variant: "destructive" });
            return;
        }
        // Removed allUsers.find()
        const approverId = approverEmail; // Directly use email as ID

        try {
            // Create an approval request
            const { error: approvalError } = await supabase
                .from('approvals')
                .insert([{
                    document_id: selectedDocumentForApproval.id,
                    approver_id: approverId, // Use the provided approver email/ID
                    requested_by_user_id: userId,
                    status: 'pending',
                    approval_order: 1, // Assuming simple single-step approval for now
                }]);

            if (approvalError) {
                console.error("Error creating approval request:", approvalError.message || approvalError);
                toast({ title: 'Error', description: `Failed to create approval request: ${approvalError.message || 'Unknown error'}`, variant: 'destructive' });
                return;
            }

            // Update document status and current_approver_id
            const { error: documentUpdateError } = await supabase
                .from('documents')
                .update({
                    status: 'sent_for_approval',
                    current_approver_id: approverId, // Use the provided approver email/ID
                })
                .eq('id', selectedDocumentForApproval.id)
                .eq('user_id', userId); // Ensure only owner can update

            if (documentUpdateError) {
                console.error("Error updating document status for approval:", documentUpdateError.message || documentUpdateError);
                toast({ title: 'Error', description: `Failed to update document status: ${documentUpdateError.message || 'Unknown error'}`, variant: 'destructive' });
                // Consider rolling back approval request if document update fails
                return;
            }

            toast({ title: 'Success', description: `Approval requested for "${selectedDocumentForApproval.title}" from ${approverEmail}.` });
            setOpenRequestApprovalModal(false);
            setApproverEmail("");
            fetchDocuments(); // Re-fetch to update list
        } catch (error: any) {
            console.error("An unexpected error occurred while requesting approval:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
        }
    };

    // Handle sharing document
    const handleShareDocument = async () => {
        if (!userId || !selectedDocumentForShare) {
            toast({ title: "Error", description: "Invalid request.", variant: "destructive" });
            return;
        }
        // Removed allUsers.find()
        const userToShareWithId = shareUserEmail; // Directly use email as ID

        const currentSharedWith = selectedDocumentForShare.shared_with || [];
        if (currentSharedWith.includes(userToShareWithId)) {
            toast({ title: "Info", description: "Document already shared with this user.", variant: "default" });
            return;
        }

        try {
            const { error } = await supabase
                .from('documents')
                .update({ shared_with: [...currentSharedWith, userToShareWithId] })
                .eq('id', selectedDocumentForShare.id)
                .eq('user_id', userId); // Only owner can share

            if (error) {
                console.error("Error sharing document:", error.message || error);
                toast({ title: 'Error', description: `Failed to share document: ${error.message || 'Unknown error'}`, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: `Document shared with ${shareUserEmail}.` });
                setOpenShareDocumentModal(false);
                setShareUserEmail("");
                fetchDocuments(); // Re-fetch to update list
            }
        } catch (error: any) {
            console.error("An unexpected error occurred while sharing document:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
        }
    };

    // Handle deleting a document
    const handleDeleteDocument = async (documentId: number, documentTitle: string) => {
        if (!userId) {
            toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
            return;
        }
        // Using a custom modal for confirmation instead of window.confirm
        // For brevity, I'll use a simple alert-like toast, but you'd replace this with a proper confirmation modal.
        if (!window.confirm(`Are you sure you want to delete "${documentTitle}"? This action cannot be undone.`)) {
             return;
        }
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', documentId)
                .eq('user_id', userId); // Ensure only owner can delete

            if (error) {
                console.error("Error deleting document:", error.message || error);
                toast({ title: 'Error', description: `Failed to delete document: ${error.message || 'Unknown error'}`, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: `Document "${documentTitle}" deleted.` });
                fetchDocuments(); // Re-fetch to update list
            }
        } catch (error: any) {
            console.error("An unexpected error occurred while deleting document:", error.message || error);
            toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
        }
    };

    // The `filteredDocuments` memo is no longer needed as `fetchDocuments` handles filtering
    // based on `searchTerm` directly in the Supabase query.
    // The `documents` state already holds the filtered results.

    const getStatusBadgeVariant = (status: Document['status']) => {
        switch (status) {
            case 'draft': return 'outline';
            case 'sent_for_signature': return 'secondary';
            case 'signed': return 'default'; // Or 'success' if you have one
            case 'sent_for_approval': return 'secondary';
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'archived': return 'outline';
            default: return 'outline';
        }
    };

    const getStatusBadgeColor = (status: Document['status']) => {
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
    };


    return (
        <div className="flex flex-col">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="md:hidden">
                    <MobileNav />
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Document Management</h2>
                    <div className="flex items-center space-x-2">
                        <Button className="bg-[#2660ff] hover:bg-[#1a4cd1]" onClick={() => setOpenCreateDocumentModal(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create New
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Your Documents</CardTitle>
                                    <CardDescription>Manage your created and shared documents.</CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search by title or client name..."
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <div className="border-b px-4">
                                    <TabsList className="justify-start -mb-px">
                                        <TabsTrigger value="my-documents">My Documents</TabsTrigger>
                                        <TabsTrigger value="shared-with-me">Shared With Me</TabsTrigger>
                                        <TabsTrigger value="pending-signatures">Pending Signatures</TabsTrigger>
                                        <TabsTrigger value="pending-approvals">Pending Approvals</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value={activeTab} className="m-0 p-4">
                                    <ScrollArea className="h-[calc(100vh-380px)]">
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {loading ? (
                                                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                                    <p>Loading documents...</p>
                                                </div>
                                            ) : (
                                                documents.length > 0 ? (
                                                    documents.map((doc) => (
                                                        <Card key={doc.id} onClick={() => handleViewOrEditDocument(doc.id)} className="cursor-pointer hover:shadow-lg transition-shadow">
                                                            <CardHeader className="p-4 pb-2">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="space-y-1">
                                                                        <CardTitle className="text-base">{doc.title}</CardTitle>
                                                                        <CardDescription className="line-clamp-2">
                                                                            Type: {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}
                                                                            {doc.client_name && ` | Client: ${doc.client_name}`}
                                                                        </CardDescription>
                                                                    </div>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}> {/* Prevent card click when dropdown is opened */}
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                                <span className="sr-only">More</span>
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem onClick={() => handleViewOrEditDocument(doc.id)}>
                                                                                <Eye className="mr-2 h-4 w-4" /> View / Edit
                                                                            </DropdownMenuItem>
                                                                            {doc.user_id === userId && ( // Only owner can request signature/approval/share
                                                                                <>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={() => { setSelectedDocumentForSignature(doc); setOpenRequestSignatureModal(true); }}>
                                                                                        <Signature className="mr-2 h-4 w-4" /> Request Signature
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => { setSelectedDocumentForApproval(doc); setOpenRequestApprovalModal(true); }}>
                                                                                        <CheckSquare className="mr-2 h-4 w-4" /> Request Approval
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => { setSelectedDocumentForShare(doc); setOpenShareDocumentModal(true); }}>
                                                                                        <Share2 className="mr-2 h-4 w-4" /> Share Document
                                                                                    </DropdownMenuItem>
                                                                                </>
                                                                            )}
                                                                            {doc.user_id === userId && ( // Only owner can delete
                                                                                <>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id, doc.title); }}>
                                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                                    </DropdownMenuItem>
                                                                                </>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="p-4 pt-0">
                                                                <div className="mt-2 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Created: {format(new Date(doc.created_at), 'MMM d,yyyy')}
                                                                        </span>
                                                                        <Badge
                                                                            variant={getStatusBadgeVariant(doc.status)}
                                                                            className={`${getStatusBadgeColor(doc.status)}`}
                                                                        >
                                                                            {doc.status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-muted-foreground">
                                                                            Last Updated: {formatDistanceToNowStrict(new Date(doc.updated_at), { addSuffix: true })}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            By: {doc.creator_name || 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                                                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                                                        <p className="text-lg font-medium">No documents found</p>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {activeTab === 'my-documents' && "Create a new document to get started."}
                                                            {activeTab === 'shared-with-me' && "No documents have been shared with you."}
                                                            {activeTab === 'pending-signatures' && "No documents require your signature."}
                                                            {activeTab === 'pending-approvals' && "No documents require your approval."}
                                                        </p>
                                                        {activeTab === 'my-documents' && (
                                                            <Button className="mt-4 bg-[#2660ff] hover:bg-[#1a4cd1]" onClick={() => setOpenCreateDocumentModal(true)}>
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                Create First Document
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Create Document Modal */}
            <Dialog open={openCreateDocumentModal} onOpenChange={setOpenCreateDocumentModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Document</DialogTitle>
                        <DialogDescription>Enter the title and type for your new document.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={newDocumentTitle}
                                onChange={(e) => setNewDocumentTitle(e.target.value)}
                                className="col-span-3"
                                placeholder="My New Document"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <Select value={newDocumentType} onValueChange={(value: 'document' | 'approval') => setNewDocumentType(value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="document">Standard Document</SelectItem>
                                    <SelectItem value="approval">Approval Document</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="client" className="text-right">
                                Client (Optional)
                            </Label>
                            <Select
                                value={newDocumentClientId?.toString() || "none"} // Set default value to "none"
                                onValueChange={(value) => {
                                    const selectedClient = value === "none" ? null : allClients.find(c => c.id === parseInt(value));
                                    setNewDocumentClientId(selectedClient?.id || null);
                                    setNewDocumentClientName(selectedClient?.name || null);
                                }}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem> {/* Changed value to "none" */}
                                    {allClients.map(client => (
                                        <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setOpenCreateDocumentModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateDocument} className="bg-[#2660ff] hover:bg-[#1a4cd1]">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Request Signature Modal */}
            <Dialog open={openRequestSignatureModal} onOpenChange={setOpenRequestSignatureModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Request Signature</DialogTitle>
                        <DialogDescription>Request a signature for "{selectedDocumentForSignature?.title}".</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="signer-email" className="text-right">
                                Signer Email
                            </Label>
                            {/* Changed to Input as allUsers is not dynamically populated */}
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
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setOpenRequestSignatureModal(false)}>Cancel</Button>
                        <Button onClick={handleRequestSignature} className="bg-[#2660ff] hover:bg-[#1a4cd1]">Send Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Request Approval Modal */}
            <Dialog open={openRequestApprovalModal} onOpenChange={setOpenRequestApprovalModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Request Approval</DialogTitle>
                        <DialogDescription>Request approval for "{selectedDocumentForApproval?.title}".</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="approver-email" className="text-right">
                                Approver Email
                            </Label>
                            {/* Changed to Input as allUsers is not dynamically populated */}
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
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setOpenRequestApprovalModal(false)}>Cancel</Button>
                        <Button onClick={handleRequestApproval} className="bg-[#2660ff] hover:bg-[#1a4cd1]">Send Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Share Document Modal */}
            <Dialog open={openShareDocumentModal} onOpenChange={setOpenShareDocumentModal}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Share Document</DialogTitle>
                        <DialogDescription>Share "{selectedDocumentForShare?.title}" with another user.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="share-user-email" className="text-right">
                                User Email
                            </Label>
                            {/* Changed to Input as allUsers is not dynamically populated */}
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
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setOpenShareDocumentModal(false)}>Cancel</Button>
                        <Button onClick={handleShareDocument} className="bg-[#2660ff] hover:bg-[#1a4cd1]">Share</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
