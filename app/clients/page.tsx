"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Search, Plus, MoreHorizontal, Filter, Download, Upload, Mail, Phone, Calendar, FileText, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileNav } from "@/components/mobile-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Assuming Textarea is used for notes
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { useRouter } from 'next/navigation'; // Import useRouter for navigation

// Define Client interface to match Supabase schema and local usage
interface Client {
    id: number;
    name: string;
    contact_name: string; // Changed to match Supabase snake_case
    email: string;
    phone: string;
    status: "active" | "inactive"; // Changed to lowercase for Supabase enum/text
    type: string;
    industry: string;
    last_contact: string; // Changed to match Supabase snake_case (ISO string from DB)
    avatar?: string; // Optional, might be derived or stored elsewhere
    initials: string; // Derived, not stored in DB directly
}

// State for new client creation
interface NewClientState {
    name: string;
    contact_name: string;
    email: string;
    phone: string;
    status: "active" | "inactive";
    type: string;
    industry: string;
    last_contact: string; // Will be ISO string for DB insertion
}

// State for editing client
interface EditClientState {
    id: number;
    name: string;
    contact_name: string;
    email: string;
    phone: string;
    status: "active" | "inactive";
    type: string;
    industry: string;
    last_contact: string; // Will be YYYY-MM-DD for date input
}


export default function ClientsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [openAddClientModal, setOpenAddClientModal] = useState(false);
    const [newClient, setNewClient] = useState<NewClientState>({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        status: "active",
        type: "",
        industry: "",
        last_contact: new Date().toISOString().split('T')[0], // Default to today's date for new client
    });
    const [openViewClientModal, setOpenViewClientModal] = useState(false);
    const [selectedClientForView, setSelectedClientForView] = useState<Client | null>(null);
    const [clients, setClients] = useState<Client[]>([]); // Initialize as empty, data fetched from Supabase
    const [openEditClientModal, setOpenEditClientModal] = useState(false);
    const [editClientData, setEditClientData] = useState<EditClientState | null>(null); // Consolidated edit state
    const { toast } = useToast(); // Initialize toast
    const router = useRouter(); // Initialize useRouter

    // Fetch clients on component mount
    useEffect(() => {
        fetchClients();
    }, []);

    // Function to fetch clients from Supabase
    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clients') // Your Supabase table name for clients
                .select('*')
                .order('name', { ascending: true }); // Order by name for consistent display

            if (error) {
                console.error('Error fetching clients:', error);
                toast({ title: 'Error', description: 'Failed to fetch clients.', variant: 'destructive' });
                return;
            }

            if (data) {
                // Map Supabase data to your Client interface, handling snake_case and derived properties
                const formattedClients: Client[] = data.map((clientData: any) => ({
                    id: clientData.id,
                    name: clientData.name,
                    contact_name: clientData.contact_name,
                    email: clientData.email,
                    phone: clientData.phone,
                    status: clientData.status, // Should already be 'active' or 'inactive'
                    type: clientData.type,
                    industry: clientData.industry,
                    last_contact: clientData.last_contact, // ISO string
                    avatar: clientData.avatar || "/placeholder.svg?height=40&width=40", // Use existing or default
                    initials: clientData.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
                }));
                setClients(formattedClients);
            }
        } catch (error) {
            console.error('An unexpected error occurred while fetching clients:', error);
            toast({ title: 'Error', description: 'An unexpected error occurred while fetching clients.', variant: 'destructive' });
        }
    };

    // Handle input change for new client modal
    const handleNewClientInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setNewClient((prev) => ({ ...prev, [id]: value }));
    };

    // Handle adding a new client to Supabase
    const handleCreateNewClient = async () => {
        try {
            // Prepare data for Supabase insertion
            const clientToInsert = {
                name: newClient.name,
                contact_name: newClient.contact_name,
                email: newClient.email,
                phone: newClient.phone,
                status: newClient.status,
                type: newClient.type,
                industry: newClient.industry,
                last_contact: newClient.last_contact ? new Date(newClient.last_contact).toISOString() : null, // Convert to ISO string
            };

            const { error } = await supabase
                .from('clients')
                .insert([clientToInsert]);

            if (error) {
                // Enhanced error logging
                console.error('Error creating client:', error.message || error);
                console.error('Full error object:', error);
                toast({ title: 'Error', description: `Failed to create client: ${error.message || 'Unknown error'}`, variant: 'destructive' });
                return;
            }

            setOpenAddClientModal(false);
            // Reset new client form state
            setNewClient({
                name: "",
                contact_name: "",
                email: "",
                phone: "",
                status: "active",
                type: "",
                industry: "",
                last_contact: new Date().toISOString().split('T')[0],
            });
            toast({ title: 'Success', description: `Client "${newClient.name}" created successfully.` });
            fetchClients(); // Re-fetch clients to update the list
        } catch (error) {
            console.error('An unexpected error occurred while creating the client:', error);
            toast({ title: 'Error', description: 'An unexpected error occurred while creating the client.', variant: 'destructive' });
        }
    };

    const handleViewClientDetails = (client: Client) => {
        setSelectedClientForView(client);
        setOpenViewClientModal(true);
    };

    // Handle opening edit client modal and populating data
    const handleEditClient = (client: Client) => {
        // Ensure client.last_contact is a valid date string before formatting
        const formattedLastContact = client.last_contact ? new Date(client.last_contact).toISOString().split('T')[0] : '';

        // Set the selected client for edit (if needed for other operations)
        // Note: The original code had setSelectedClientForEdit, but it wasn't defined.
        // If you need to store the full client object for edit, you'd define a state for it.
        // For now, we'll just populate editClientData directly.

        setEditClientData({
            id: client.id,
            name: client.name,
            contact_name: client.contact_name,
            email: client.email,
            phone: client.phone,
            status: client.status,
            type: client.type,
            industry: client.industry,
            last_contact: formattedLastContact, // Format for date input
        });
        setOpenEditClientModal(true);
    };

    // Handle input change for edit client modal
    const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setEditClientData((prev) => (prev ? { ...prev, [id]: value } : null));
    };

    // Handle saving edited client details to Supabase
    const handleSaveEditClient = async () => {
        if (!editClientData) {
            return;
        }

        try {
            // Prepare data for Supabase update
            const clientToUpdate = {
                name: editClientData.name,
                contact_name: editClientData.contact_name,
                email: editClientData.email,
                phone: editClientData.phone,
                status: editClientData.status,
                type: editClientData.type,
                industry: editClientData.industry,
                last_contact: editClientData.last_contact ? new Date(editClientData.last_contact).toISOString() : null, // Convert to ISO string
            };

            const { error } = await supabase
                .from('clients')
                .update(clientToUpdate)
                .eq('id', editClientData.id); // Update by ID

            if (error) {
                console.error('Error updating client:', error);
                toast({ title: 'Error', description: 'Failed to update client.', variant: 'destructive' });
                return;
            }

            setOpenEditClientModal(false);
            // setSelectedClientForEdit(null); // Clear selected client for edit if it was used
            setEditClientData(null); // Clear edit state
            toast({ title: 'Success', description: `Client "${editClientData.name}" updated successfully.` });
            fetchClients(); // Re-fetch clients to update the list
        } catch (error) {
            console.error('An unexpected error occurred while updating the client:', error);
            toast({ title: 'Error', description: 'An unexpected error occurred while updating the client.', variant: 'destructive' });
        }
    };

    // Handle deleting a client from Supabase
    const handleDeleteClient = async (clientId: number, clientName: string) => {
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', clientId);

            if (error) {
                console.error('Error deleting client:', error);
                toast({ title: 'Error', description: 'Failed to delete client.', variant: 'destructive' });
                return;
            }

            toast({ title: 'Success', description: `Client "${clientName}" deleted successfully.` });
            fetchClients(); // Re-fetch clients to update the list
        } catch (error) {
            console.error('An unexpected error occurred while deleting the client:', error);
            toast({ title: 'Error', description: 'An unexpected error occurred while deleting the client.', variant: 'destructive' });
        }
    };

    // Client interaction functions
    const handleCallClient = (phone: string | null | undefined) => {
        if (phone) {
            window.open(`tel:${phone}`);
        } else {
            toast({ title: 'Info', description: 'Phone number not available for this client.', variant: 'default' });
        }
    };

    const handleEmailClient = (email: string | null | undefined) => {
        if (email) {
            window.open(`mailto:${email}`);
        } else {
            toast({ title: 'Info', description: 'Email address not available for this client.', variant: 'default' });
        }
    };

    const handleScheduleEvent = (clientName: string) => {
        console.log("Attempting to navigate to calendar for client:", clientName);
        console.log("Router object:", router);
        const url = `/calendar?client=${encodeURIComponent(clientName)}`;
        console.log("Target URL:", url);
        router.push(url);
        toast({ title: 'Info', description: `Navigating to calendar to schedule event for ${clientName}.`, variant: 'default' });
    };

    const filteredClients = clients.filter((client) => {
        const matchesSearch =
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase());

        if (activeTab === "all") return matchesSearch;
        if (activeTab === "active") return matchesSearch && client.status === "active";
        if (activeTab === "inactive") return matchesSearch && client.status === "inactive";

        return matchesSearch;
    });

    return (
        <div className="flex flex-col">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="md:hidden">
                    <MobileNav />
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
                    <div className="flex items-center space-x-2">
                        <Dialog open={openAddClientModal} onOpenChange={setOpenAddClientModal}>
                            <DialogTrigger asChild>
                                <Button className="bg-[#2660ff] hover:bg-[#1a4cd1]">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Client
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Client</DialogTitle>
                                    <DialogDescription>Enter the details for the new client.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="name" className="text-right">
                                            Name
                                        </Label>
                                        <Input id="name" value={newClient.name} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="contact_name" className="text-right">
                                            Contact Name
                                        </Label>
                                        <Input id="contact_name" value={newClient.contact_name} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="email" className="text-right">
                                            Email
                                        </Label>
                                        <Input id="email" type="email" value={newClient.email} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="phone" className="text-right">
                                            Phone
                                        </Label>
                                        <Input id="phone" type="tel" value={newClient.phone} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="type" className="text-right">
                                            Type
                                        </Label>
                                        <select
                                            id="type"
                                            value={newClient.type}
                                            onChange={handleNewClientInputChange}
                                            className="col-span-3 border border-input bg-background px-3 py-2 text-sm shadow-sm rounded-md"
                                        >
                                            <option value="">Select type</option>
                                            <option value="Corporate">Corporate</option>
                                            <option value="Startup">Startup</option>
                                            <option value="Small Business">Small Business</option>
                                            <option value="Enterprise">Enterprise</option>
                                            <option value="Non-Profit">Non-Profit</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="industry" className="text-right">
                                            Industry
                                        </Label>
                                        <Input id="industry" value={newClient.industry} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="last_contact" className="text-right">
                                            Last Contact
                                        </Label>
                                        <Input id="last_contact" type="date" value={newClient.last_contact} onChange={handleNewClientInputChange} className="col-span-3" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="status" className="text-right">
                                            Status
                                        </Label>
                                        <select
                                            id="status"
                                            value={newClient.status}
                                            onChange={handleNewClientInputChange}
                                            className="col-span-3 border border-input bg-background px-3 py-2 text-sm shadow-sm rounded-md"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="secondary" onClick={() => setOpenAddClientModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="button" onClick={handleCreateNewClient}>
                                        Add
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="flex flex-col space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Client Management</CardTitle>
                                    <CardDescription>Manage your client relationships</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Filter className="mr-2 h-4 w-4" />
                                                Filter
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>Type</DropdownMenuItem>
                                            <DropdownMenuItem>Industry</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setActiveTab("active")}>Active Status</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setActiveTab("inactive")}>Inactive Status</DropdownMenuItem>
                                            <DropdownMenuItem>Last Contact</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Download className="mr-2 h-4 w-4" />
                                                Export
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>
                                                <FileText className="mr-2 h-4 w-4" />
                                                CSV
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Excel
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FileText className="mr-2 h-4 w-4" />
                                                PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button variant="outline" size="sm">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-4">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search clients..."
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
                                        <TabsTrigger value="all">All Clients</TabsTrigger>
                                        <TabsTrigger value="active">Active</TabsTrigger>
                                        <TabsTrigger value="inactive">Inactive</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value="all" className="m-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead className="hidden md:table-cell">Type</TableHead>
                                                <TableHead className="hidden md:table-cell">Industry</TableHead>
                                                <TableHead className="hidden md:table-cell">Last Contact</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredClients.map((client) => (
                                                <TableRow key={client.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarImage src={client.avatar || "/placeholder.svg"} alt={client.name} />
                                                                <AvatarFallback>{client.initials}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{client.name}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{client.contact_name}</div>
                                                        <div className="text-sm text-muted-foreground">{client.email}</div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.type}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.industry}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.last_contact ? new Date(client.last_contact).toLocaleDateString() : 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={`${
                                                                client.status === "active"
                                                                    ? "border-green-500 text-green-500"
                                                                    : "border-red-500 text-red-500"
                                                            }`}
                                                        >
                                                            {(client.status ?? '').charAt(0).toUpperCase() + (client.status ?? '').slice(1)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEmailClient(client.email)}>
                                                                <Mail className="h-4 w-4" />
                                                                <span className="sr-only">Email</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleCallClient(client.phone)}>
                                                                <Phone className="h-4 w-4" />
                                                                <span className="sr-only">Call</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleScheduleEvent(client.name)}>
                                                                <Calendar className="h-4 w-4" />
                                                                <span className="sr-only">Schedule</span>
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                        <span className="sr-only">More</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>View Details</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleEditClient(client)}>Edit Client</DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClient(client.id, client.name)}>Delete Client</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredClients.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <p className="text-lg font-medium">No clients found</p>
                                                            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                                <TabsContent value="active" className="m-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead className="hidden md:table-cell">Type</TableHead>
                                                <TableHead className="hidden md:table-cell">Industry</TableHead>
                                                <TableHead className="hidden md:table-cell">Last Contact</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredClients.filter(c => c.status === 'active').map((client) => (
                                                <TableRow key={client.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarImage src={client.avatar || "/placeholder.svg"} alt={client.name} />
                                                                <AvatarFallback>{client.initials}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{client.name}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{client.contact_name}</div>
                                                        <div className="text-sm text-muted-foreground">{client.email}</div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.type}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.industry}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.last_contact ? new Date(client.last_contact).toLocaleDateString() : 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className="border-green-500 text-green-500"
                                                        >
                                                            {(client.status ?? '').charAt(0).toUpperCase() + (client.status ?? '').slice(1)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEmailClient(client.email)}>
                                                                <Mail className="h-4 w-4" />
                                                                <span className="sr-only">Email</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleCallClient(client.phone)}>
                                                                <Phone className="h-4 w-4" />
                                                                <span className="sr-only">Call</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleScheduleEvent(client.name)}>
                                                                <Calendar className="h-4 w-4" />
                                                                <span className="sr-only">Schedule</span>
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                        <span className="sr-only">More</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>View Details</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleEditClient(client)}>Edit Client</DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClient(client.id, client.name)}>Delete Client</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredClients.filter(c => c.status === 'active').length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <p className="text-lg font-medium">No active clients found</p>
                                                            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                                <TabsContent value="inactive" className="m-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead className="hidden md:table-cell">Type</TableHead>
                                                <TableHead className="hidden md:table-cell">Industry</TableHead>
                                                <TableHead className="hidden md:table-cell">Last Contact</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredClients.filter(c => c.status === 'inactive').map((client) => (
                                                <TableRow key={client.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarImage src={client.avatar || "/placeholder.svg"} alt={client.name} />
                                                                <AvatarFallback>{client.initials}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{client.name}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{client.contact_name}</div>
                                                        <div className="text-sm text-muted-foreground">{client.email}</div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.type}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.industry}</TableCell>
                                                    <TableCell className="hidden md:table-cell">{client.last_contact ? new Date(client.last_contact).toLocaleDateString() : 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className="border-red-500 text-red-500"
                                                        >
                                                            {(client.status ?? '').charAt(0).toUpperCase() + (client.status ?? '').slice(1)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEmailClient(client.email)}>
                                                                <Mail className="h-4 w-4" />
                                                                <span className="sr-only">Email</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleCallClient(client.phone)}>
                                                                <Phone className="h-4 w-4" />
                                                                <span className="sr-only">Call</span>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleScheduleEvent(client.name)}>
                                                                <Calendar className="h-4 w-4" />
                                                                <span className="sr-only">Schedule</span>
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                        <span className="sr-only">More</span>
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>View Details</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleEditClient(client)}>Edit Client</DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClient(client.id, client.name)}>Delete Client</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredClients.filter(c => c.status === 'inactive').length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <p className="text-lg font-medium">No inactive clients found</p>
                                                            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={openViewClientModal} onOpenChange={setOpenViewClientModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedClientForView?.name}</DialogTitle>
                        <DialogDescription>Details for the selected client.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-muted-foreground">Contact Name</Label>
                                <p className="font-medium">{selectedClientForView?.contact_name}</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Email</Label>
                                <p className="font-medium">{selectedClientForView?.email}</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Phone</Label>
                                <p className="font-medium">{selectedClientForView?.phone}</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Status</Label>
                                <Badge
                                    variant="outline"
                                    className={`${
                                        selectedClientForView?.status === "active"
                                            ? "border-green-500 text-green-500"
                                            : "border-red-500 text-red-500"
                                    }`}
                                >
                                    {(selectedClientForView?.status ?? '').charAt(0).toUpperCase() + (selectedClientForView?.status ?? '').slice(1)}
                                </Badge>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Type</Label>
                                <p className="font-medium">{selectedClientForView?.type || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Industry</Label>
                                <p className="font-medium">{selectedClientForView?.industry || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Last Contact</Label>
                                <p className="font-medium">{selectedClientForView?.last_contact ? new Date(selectedClientForView.last_contact).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setOpenViewClientModal(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openEditClientModal} onOpenChange={setOpenEditClientModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Client</DialogTitle>
                        <DialogDescription>Edit the details for the selected client.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input id="name" value={editClientData?.name || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="contact_name" className="text-right">
                                Contact Name
                            </Label>
                            <Input id="contact_name" value={editClientData?.contact_name || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input id="email" type="email" value={editClientData?.email || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">
                                Phone
                            </Label>
                            <Input id="phone" type="tel" value={editClientData?.phone || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <select
                                id="type"
                                value={editClientData?.type || ""}
                                onChange={handleEditInputChange}
                                className="col-span-3 border border-input bg-background px-3 py-2 text-sm shadow-sm rounded-md"
                            >
                                <option value="">Select type</option>
                                <option value="Corporate">Corporate</option>
                                <option value="Startup">Startup</option>
                                <option value="Small Business">Small Business</option>
                                <option value="Enterprise">Enterprise</option>
                                <option value="Non-Profit">Non-Profit</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="industry" className="text-right">
                                Industry
                            </Label>
                            <Input id="industry" value={editClientData?.industry || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="last_contact" className="text-right">
                                Last Contact
                            </Label>
                            <Input id="last_contact" type="date" value={editClientData?.last_contact || ""} onChange={handleEditInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="status" className="text-right">
                                Status
                            </Label>
                            <select
                                id="status"
                                value={editClientData?.status || "active"}
                                onChange={handleEditInputChange}
                                className="col-span-3 border border-input bg-background px-3 py-2 text-sm shadow-sm rounded-md"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setOpenEditClientModal(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveEditClient}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
