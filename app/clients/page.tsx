"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, MoreHorizontal, Filter, Download, Upload, Mail, Phone, Calendar, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MobileNav } from "@/components/mobile-nav"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"

// Define Client interface to match Supabase schema and local usage
interface Client {
  id: number
  name: string
  contact_name: string
  email: string
  phone: string
  status: "active" | "inactive"
  type: string
  industry: string
  last_contact: string
  avatar?: string
  initials: string
}

// State for new client creation
interface NewClientState {
  name: string
  contact_name: string
  email: string
  phone: string
  status: "active" | "inactive"
  type: string
  industry: string
  last_contact: string
}

// State for editing client
interface EditClientState {
  id: number
  name: string
  contact_name: string
  email: string
  phone: string
  status: "active" | "inactive"
  type: string
  industry: string
  last_contact: string
}

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [openAddClientModal, setOpenAddClientModal] = useState(false)
  const [newClient, setNewClient] = useState<NewClientState>({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    status: "active",
    type: "",
    industry: "",
    last_contact: new Date().toISOString().split("T")[0],
  })
  const [openViewClientModal, setOpenViewClientModal] = useState(false)
  const [selectedClientForView, setSelectedClientForView] = useState<Client | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [openEditClientModal, setOpenEditClientModal] = useState(false)
  const [editClientData, setEditClientData] = useState<EditClientState | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { toast } = useToast()
  const router = useRouter()

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error checking authentication:", error)
          setIsAuthenticated(false)
          setIsLoading(false)
          return
        }

        if (session?.user) {
          setIsAuthenticated(true)
          setUserId(session.user.id)
          // Only fetch clients if user is authenticated
          await fetchClients(session.user.id)
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Unexpected error during authentication check:", error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setIsAuthenticated(true)
        setUserId(session.user.id)
        await fetchClients(session.user.id)
      } else if (event === "SIGNED_OUT") {
        setIsAuthenticated(false)
        setUserId(null)
        setClients([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Function to fetch clients from Supabase with user authentication
  const fetchClients = async (currentUserId?: string) => {
    try {
      const userIdToUse = currentUserId || userId
      if (!userIdToUse) {
        console.error("No user ID available for fetching clients")
        return
      }

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", userIdToUse) // Filter by user_id to ensure users only see their own clients
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching clients:", error)
        toast({ title: "Error", description: "Failed to fetch clients.", variant: "destructive" })
        return
      }

      if (data) {
        const formattedClients: Client[] = data.map((clientData: any) => ({
          id: clientData.id,
          name: clientData.name,
          contact_name: clientData.contact_name,
          email: clientData.email,
          phone: clientData.phone,
          status: clientData.status,
          type: clientData.type,
          industry: clientData.industry,
          last_contact: clientData.last_contact,
          avatar: clientData.avatar || "/placeholder.svg?height=40&width=40",
          initials: clientData.name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
        }))
        setClients(formattedClients)
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching clients:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching clients.",
        variant: "destructive",
      })
    }
  }

  // Handle input change for new client modal
  const handleNewClientInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target
    setNewClient((prev) => ({ ...prev, [id]: value }))
  }

  // Handle adding a new client to Supabase
  const handleCreateNewClient = async () => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" })
      return
    }

    try {
      const clientToInsert = {
        user_id: userId, // Associate client with current user
        name: newClient.name,
        contact_name: newClient.contact_name,
        email: newClient.email,
        phone: newClient.phone,
        status: newClient.status,
        type: newClient.type,
        industry: newClient.industry,
        last_contact: newClient.last_contact ? new Date(newClient.last_contact).toISOString() : null,
      }

      const { error } = await supabase.from("clients").insert([clientToInsert])

      if (error) {
        console.error("Error creating client:", error.message || error)
        console.error("Full error object:", error)
        toast({
          title: "Error",
          description: `Failed to create client: ${error.message || "Unknown error"}`,
          variant: "destructive",
        })
        return
      }

      setOpenAddClientModal(false)
      setNewClient({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        status: "active",
        type: "",
        industry: "",
        last_contact: new Date().toISOString().split("T")[0],
      })
      toast({ title: "Success", description: `Client "${newClient.name}" created successfully.` })
      fetchClients()
    } catch (error) {
      console.error("An unexpected error occurred while creating the client:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the client.",
        variant: "destructive",
      })
    }
  }

  const handleViewClientDetails = (client: Client) => {
    setSelectedClientForView(client)
    setOpenViewClientModal(true)
  }

  // Handle opening edit client modal and populating data
  const handleEditClient = (client: Client) => {
    const formattedLastContact = client.last_contact ? new Date(client.last_contact).toISOString().split("T")[0] : ""

    setEditClientData({
      id: client.id,
      name: client.name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone,
      status: client.status,
      type: client.type,
      industry: client.industry,
      last_contact: formattedLastContact,
    })
    setOpenEditClientModal(true)
  }

  // Handle input change for edit client modal
  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target
    setEditClientData((prev) => (prev ? { ...prev, [id]: value } : null))
  }

  // Handle saving edited client details to Supabase
  const handleSaveEditClient = async () => {
    if (!editClientData || !userId) {
      toast({
        title: "Error",
        description: "Client data not loaded or user not authenticated.",
        variant: "destructive",
      })
      return
    }

    try {
      const clientToUpdate = {
        name: editClientData.name,
        contact_name: editClientData.contact_name,
        email: editClientData.email,
        phone: editClientData.phone,
        status: editClientData.status,
        type: editClientData.type,
        industry: editClientData.industry,
        last_contact: editClientData.last_contact ? new Date(editClientData.last_contact).toISOString() : null,
      }

      const { error } = await supabase
        .from("clients")
        .update(clientToUpdate)
        .eq("id", editClientData.id)
        .eq("user_id", userId) // Ensure user can only edit their own clients

      if (error) {
        console.error("Error updating client:", error)
        toast({ title: "Error", description: "Failed to update client.", variant: "destructive" })
        return
      }

      setOpenEditClientModal(false)
      setEditClientData(null)
      toast({ title: "Success", description: `Client "${editClientData.name}" updated successfully.` })
      fetchClients()
    } catch (error) {
      console.error("An unexpected error occurred while updating the client:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the client.",
        variant: "destructive",
      })
    }
  }

  // Handle deleting a client from Supabase
  const handleDeleteClient = async (clientId: number, clientName: string) => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" })
      return
    }

    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("user_id", userId) // Ensure user can only delete their own clients

      if (error) {
        console.error("Error deleting client:", error)
        toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" })
        return
      }

      toast({ title: "Success", description: `Client "${clientName}" deleted successfully.` })
      fetchClients()
    } catch (error) {
      console.error("An unexpected error occurred while deleting the client:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the client.",
        variant: "destructive",
      })
    }
  }

  // Client interaction functions
  const handleCallClient = (phone: string | null | undefined) => {
    if (phone) {
      window.open(`tel:${phone}`)
    } else {
      toast({ title: "Info", description: "Phone number not available for this client.", variant: "default" })
    }
  }

  const handleEmailClient = (email: string | null | undefined) => {
    if (email) {
      window.open(`mailto:${email}`)
    } else {
      toast({ title: "Info", description: "Email address not available for this client.", variant: "default" })
    }
  }

  const handleScheduleEvent = (clientName: string) => {
    console.log("Attempting to navigate to calendar for client:", clientName)
    console.log("Router object:", router)
    const url = `/calendar?client=${encodeURIComponent(clientName)}`
    console.log("Target URL:", url)
    router.push(url)
    toast({
      title: "Info",
      description: `Navigating to calendar to schedule event for ${clientName}.`,
      variant: "default",
    })
  }

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())

    if (activeTab === "all") return matchesSearch
    if (activeTab === "active") return matchesSearch && client.status === "active"
    if (activeTab === "inactive") return matchesSearch && client.status === "inactive"

    return matchesSearch
  })

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2660ff] mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show authentication required message
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Authentication Required</CardTitle>
            <CardDescription>You need to be signed in to view your clients.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push("/auth")} className="bg-[#2660ff] hover:bg-[#1a4cd1]">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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
                    <Input
                      id="name"
                      value={newClient.name}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contact_name" className="text-right">
                      Contact Name
                    </Label>
                    <Input
                      id="contact_name"
                      value={newClient.contact_name}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newClient.email}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newClient.phone}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
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
                    <Input
                      id="industry"
                      value={newClient.industry}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="last_contact" className="text-right">
                      Last Contact
                    </Label>
                    <Input
                      id="last_contact"
                      type="date"
                      value={newClient.last_contact}
                      onChange={handleNewClientInputChange}
                      className="col-span-3"
                    />
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
                          <TableCell className="hidden md:table-cell">
                            {client.last_contact ? new Date(client.last_contact).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${
                                client.status === "active"
                                  ? "border-green-500 text-green-500"
                                  : "border-red-500 text-red-500"
                              }`}
                            >
                              {(client.status ?? "").charAt(0).toUpperCase() + (client.status ?? "").slice(1)}
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
                                  <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                    Edit Client
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDeleteClient(client.id, client.name)}
                                  >
                                    Delete Client
                                  </DropdownMenuItem>
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
                      {filteredClients
                        .filter((c) => c.status === "active")
                        .map((client) => (
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
                            <TableCell className="hidden md:table-cell">
                              {client.last_contact ? new Date(client.last_contact).toLocaleDateString() : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                {(client.status ?? "").charAt(0).toUpperCase() + (client.status ?? "").slice(1)}
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
                                    <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                      Edit Client
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteClient(client.id, client.name)}
                                    >
                                      Delete Client
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {filteredClients.filter((c) => c.status === "active").length === 0 && (
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
                      {filteredClients
                        .filter((c) => c.status === "inactive")
                        .map((client) => (
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
                            <TableCell className="hidden md:table-cell">
                              {client.last_contact ? new Date(client.last_contact).toLocaleDateString() : "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-red-500 text-red-500">
                                {(client.status ?? "").charAt(0).toUpperCase() + (client.status ?? "").slice(1)}
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
                                    <DropdownMenuItem onClick={() => handleViewClientDetails(client)}>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                      Edit Client
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDeleteClient(client.id, client.name)}
                                    >
                                      Delete Client
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {filteredClients.filter((c) => c.status === "inactive").length === 0 && (
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
                  {(selectedClientForView?.status ?? "").charAt(0).toUpperCase() +
                    (selectedClientForView?.status ?? "").slice(1)}
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
                <p className="font-medium">
                  {selectedClientForView?.last_contact
                    ? new Date(selectedClientForView.last_contact).toLocaleDateString()
                    : "N/A"}
                </p>
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
              <Input
                id="name"
                value={editClientData?.name || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact_name" className="text-right">
                Contact Name
              </Label>
              <Input
                id="contact_name"
                value={editClientData?.contact_name || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editClientData?.email || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={editClientData?.phone || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
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
              <Input
                id="industry"
                value={editClientData?.industry || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="last_contact" className="text-right">
                Last Contact
              </Label>
              <Input
                id="last_contact"
                type="date"
                value={editClientData?.last_contact || ""}
                onChange={handleEditInputChange}
                className="col-span-3"
              />
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
  )
}
