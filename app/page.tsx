"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDateRangePicker } from "@/components/date-range-picker";
import { Overview } from "@/components/overview";
import { MobileNav } from "@/components/mobile-nav";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, FileText } from "lucide-react"; // Import Mail icon for RecentEmails and FileText for documents
import { useRouter } from 'next/navigation'; // Import useRouter for navigation
import { ResponsiveContainer, BarChart, XAxis, YAxis, Bar, Tooltip, Legend } from 'recharts'; // Import Recharts components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components for report type
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components for reports

interface DashboardCardProps {
    title: string;
    value: string | number;
    delta?: string;
    icon?: React.ReactNode;
    onClick?: () => void; // Added onClick prop for card redirection
}

const DashboardCard: React.FC<DashboardCardProps> = ({
    title,
    value,
    delta,
    icon,
    onClick,
}) => {
    return (
        <Card className={onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""} onClick={onClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {delta && <p className="text-xs text-muted-foreground">{delta}</p>}
            </CardContent>
        </Card>
    );
};

const TotalClientsCard: React.FC = () => {
    const [totalClients, setTotalClients] = useState<number>(0);
    const router = useRouter(); // Initialize useRouter

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const { data, error } = await supabase.from("clients").select("id");
                if (error) {
                    console.error("Error fetching total clients:", error);
                } else {
                    setTotalClients(data.length);
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
            }
        };

        fetchClients();
    }, []);

    return (
        <DashboardCard
            title="Total Clients"
            value={totalClients}
            icon={
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-[#2660ff]"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            }
            onClick={() => router.push('/clients')} // Redirect to clients page
        />
    );
};

const PendingTasksCard: React.FC = () => {
    const [pendingTasksCount, setPendingTasksCount] = useState<number>(0);
    const [userId, setUserId] = useState<string | null>(null); // State to hold the current user's ID

    // Effect to get the current user's ID
    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchTasks = async () => {
            if (userId) { // Only fetch if userId is available
                try {
                    const { data, error } = await supabase
                        .from("tasks")
                        .select("id")
                        .eq("status", "Pending") // Assuming you have a 'status' column
                        .eq("user_id", userId); // Filter by user_id to respect RLS

                    if (error) {
                        console.error("Error fetching pending tasks:", error);
                    } else {
                        setPendingTasksCount(data.length);
                    }
                } catch (error) {
                    console.error("An unexpected error occurred:", error);
                }
            }
        };

        fetchTasks();
    }, [userId]); // Re-run when userId changes

    return (
        <DashboardCard
            title="Pending Tasks"
            value={pendingTasksCount}
            icon={
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-[#2660ff]"
                >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="m9 9 2 2 4-4" />
                    <path d="m9 15 2 2 4-4" />
                </svg>
            }
        />
    );
};

const UpcomingMeetingsCard: React.FC = () => {
    const [upcomingMeetingsCount, setUpcomingMeetingsCount] = useState<number>(0);
    const router = useRouter(); // Initialize useRouter

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const now = new Date();
                const tomorrowEnd = new Date();
                tomorrowEnd.setDate(now.getDate() + 2); // Next 48 hours
                tomorrowEnd.setHours(23, 59, 59, 999);

                const { data, error } = await supabase
                    .from("calendar_events")
                    .select("id")
                    .gte("date", now.toISOString().split('T')[0]) // Today or later
                    .lte("date", tomorrowEnd.toISOString().split('T')[0]);

                if (error) {
                    console.error("Error fetching upcoming meetings:", error);
                } else {
                    setUpcomingMeetingsCount(data.length);
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
            }
        };

        fetchMeetings();
    }, []);

    return (
        <DashboardCard
            title="Upcoming Meetings"
            value={upcomingMeetingsCount}
            delta="Today and tomorrow"
            icon={
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-[#2660ff]"
                >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                </svg>
            }
            onClick={() => router.push('/calendar?view=week')} // Redirect to calendar week view
        />
    );
};

const UnreadEmailsCard: React.FC = () => {
    const [unreadEmailsCount, setUnreadEmailsCount] = useState<number>(0);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter(); // Initialize useRouter

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchUnreadEmails = async () => {
            if (userId) {
                try {
                    const { data, error } = await supabase
                        .from("emails")
                        .select("id")
                        .eq("unread", true) // Corrected to expect boolean true
                        .eq("user_id", userId);

                    if (error) {
                        console.error("Error fetching unread emails:", error);
                    } else {
                        setUnreadEmailsCount(data.length);
                    }
                } catch (error) {
                    console.error("An unexpected error occurred:", error);
                }
            }
        };

        fetchUnreadEmails();
    }, [userId]);

    const lastHourIncrease = "+5 in the last hour"; // Placeholder - you'd need more logic for this

    return (
        <DashboardCard
            title="Unread Emails"
            value={unreadEmailsCount}
            delta={lastHourIncrease}
            icon={
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-[#2660ff]"
                >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            }
            onClick={() => router.push('/email?tab=inbox')} // Redirect to email inbox
        />
    );
};

const TotalDocumentsCard: React.FC = () => {
    const [totalDocuments, setTotalDocuments] = useState<number>(0);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchTotalDocuments = async () => {
            if (userId) {
                try {
                    const { data, error } = await supabase
                        .from("documents")
                        .select("id")
                        .eq("user_id", userId); // Filter by user_id

                    if (error) {
                        console.error("Error fetching total documents:", error);
                    } else {
                        setTotalDocuments(data.length);
                    }
                } catch (error) {
                    console.error("An unexpected error occurred:", error);
                }
            }
        };

        fetchTotalDocuments();
    }, [userId]);

    return (
        <DashboardCard
            title="Total Documents"
            value={totalDocuments}
            icon={
                <FileText className="h-4 w-4 text-[#2660ff]" />
            }
            onClick={() => router.push('/documents')} // Redirect to documents page
        />
    );
};


const UpcomingTasksCard: React.FC = () => {
    const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]); // Replace 'any' with your task type
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchUpcomingTasks = async () => {
            if (userId) {
                try {
                    const now = new Date();
                    const future = new Date();
                    future.setDate(now.getDate() + 2); // Next 48 hours

                    const { data, error } = await supabase
                        .from("tasks")
                        .select("id, title, due_date")
                        .gte("due_date", now.toISOString())
                        .lte("due_date", future.toISOString())
                        .eq("user_id", userId) // Ensure you only fetch the user's tasks
                        .order("due_date");

                    if (error) {
                        console.error("Error fetching upcoming tasks:", error);
                    } else {
                        setUpcomingTasks(data);
                    }
                } catch (error) {
                    console.error("An unexpected error occurred:", error);
                }
            }
        };

        fetchUpcomingTasks();
    }, [userId]);

    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Upcoming Tasks</CardTitle>
                <CardDescription>Tasks due in the next 48 hours</CardDescription>
            </CardHeader>
            <CardContent>
                {upcomingTasks.length > 0 ? (
                    <ul>
                        {upcomingTasks.map((task) => (
                            <li key={task.id} className="py-1">
                                {task.title} - {task.due_date ? format(parseISO(task.due_date), "MMM dd, HH:mm") : "No due date"}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No upcoming tasks.</p>
                )}
            </CardContent>
        </Card>
    );
};

const ClientDistributionCard: React.FC = () => {
    const [distributionData, setDistributionData] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchClientDistribution = async () => {
            try {
                // Replace 'client_type' with the actual column you want to group by
                const { data, error } = await supabase
                    .from("clients")
                    .select("type"); // Assuming 'client_type' column exists

                if (error) {
                    console.error("Error fetching client types:", error);
                } else {
                    // Process the data to count occurrences of each client type
                    const distribution: Record<string, number> = {};
                    data.forEach((client) => {
                        const type = (client as any).type || "Unknown"; // Handle potential null values and type assertion
                        distribution[type] = (distribution[type] || 0) + 1;
                    });
                    setDistributionData(distribution);
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
            }
        };

        fetchClientDistribution();
    }, []);

    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Client Distribution</CardTitle>
                <CardDescription>Breakdown of client types</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                {Object.keys(distributionData).length > 0 ? (
                    <ul>
                        {Object.entries(distributionData).map(([type, count]) => (
                            <li key={type} className="py-1">
                                {type}: {count}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No client distribution data available.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// New component for Analytics Dashboard
const AnalyticsDashboard: React.FC = () => {
    const [clientTypeData, setClientTypeData] = useState<{ name: string; value: number }[]>([]);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            try {
                // Fetch client types for the bar chart
                const { data, error } = await supabase.from("clients").select("type");

                if (error) {
                    console.error("Error fetching analytics data:", error);
                } else {
                    const counts: Record<string, number> = {};
                    data.forEach((client) => {
                        const type = (client as any).type || "Unknown";
                        counts[type] = (counts[type] || 0) + 1;
                    });
                    const formattedData = Object.entries(counts).map(([name, value]) => ({ name, value }));
                    setClientTypeData(formattedData);
                }
            } catch (error) {
                console.error("An unexpected error occurred while fetching analytics data:", error);
            }
        };

        fetchAnalyticsData();
    }, []);

    return (
        <Card className="col-span-7">
            <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>Detailed metrics and performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    {clientTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={clientTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="value" fill="#2660ff" name="Number of Clients" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            No analytics data available.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// New component for Reports Dashboard
const ReportsDashboard: React.FC = () => {
    const [reportType, setReportType] = useState<string>("client-status");
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
    const [reportData, setReportData] = useState<any[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchReportData = async () => {
            if (!userId && (reportType === 'task-progress' || reportType === 'email-activity' || reportType === 'document-overview')) {
                // For reports that require user_id, wait until it's available
                return;
            }

            setLoadingReport(true);
            setReportData([]); // Clear previous data

            try {
                let query;
                let data: any[] | null = null;
                let error: any = null;

                const fromDateISO = dateRange.from ? dateRange.from.toISOString() : null;
                const toDateISO = dateRange.to ? dateRange.to.toISOString() : null;

                switch (reportType) {
                    case "client-status":
                        // Clients table has public read access, so no user_id filter needed based on policies
                        query = supabase.from("clients").select("name, status, last_contact");
                        if (fromDateISO) query = query.gte("created_at", fromDateISO); // Assuming clients have a created_at
                        if (toDateISO) query = query.lte("created_at", toDateISO);
                        ({ data, error } = await query);
                        break;
                    case "task-progress":
                        query = supabase.from("tasks").select("title, status, priority, progress, due_date");
                        if (userId) query = query.eq("user_id", userId); // Filter by user_id
                        if (fromDateISO) query = query.gte("due_date", fromDateISO);
                        if (toDateISO) query = query.lte("due_date", toDateISO);
                        ({ data, error } = await query);
                        break;
                    case "email-activity":
                        query = supabase.from("emails").select("subject, sender, sent_at, unread");
                        if (userId) query = query.eq("user_id", userId); // Filter by user_id
                        if (fromDateISO) query = query.gte("sent_at", fromDateISO);
                        if (toDateISO) query = query.lte("sent_at", toDateISO);
                        ({ data, error } = await query);
                        break;
                    case "document-overview":
                        query = supabase.from("documents").select("title, type, status, created_at");
                        if (userId) query = query.eq("user_id", userId); // Filter by user_id
                        if (fromDateISO) query = query.gte("created_at", fromDateISO);
                        if (toDateISO) query = query.lte("created_at", toDateISO);
                        ({ data, error } = await query);
                        break;
                    default:
                        break;
                }

                if (error) {
                    console.error(`Error fetching ${reportType} report:`, error);
                } else if (data) {
                    setReportData(data);
                }
            } catch (e) {
                console.error("An unexpected error occurred while fetching report data:", e);
            } finally {
                setLoadingReport(false);
            }
        };

        fetchReportData();
    }, [reportType, dateRange, userId]);

    const renderReportContent = () => {
        if (loadingReport) {
            return (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading report data...
                </div>
            );
        }

        if (reportData.length === 0) {
            return (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available for this report type and date range.
                </div>
            );
        }

        switch (reportType) {
            case "client-status":
                return (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Contact</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{row.status}</TableCell>
                                    <TableCell>{row.last_contact ? format(parseISO(row.last_contact), "MMM dd, yyyy") : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            case "task-progress":
                return (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.title}</TableCell>
                                    <TableCell>{row.status}</TableCell>
                                    <TableCell>{row.priority}</TableCell>
                                    <TableCell>{row.progress}%</TableCell>
                                    <TableCell>{row.due_date ? format(parseISO(row.due_date), "MMM dd, yyyy HH:mm") : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            case "email-activity":
                return (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead>Sender</TableHead>
                                <TableHead>Sent At</TableHead>
                                <TableHead>Unread</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.subject}</TableCell>
                                    <TableCell>{row.sender}</TableCell>
                                    <TableCell>{row.sent_at ? format(parseISO(row.sent_at), "MMM dd, yyyy HH:mm") : 'N/A'}</TableCell>
                                    <TableCell>{row.unread ? "Yes" : "No"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            case "document-overview":
                return (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{row.title}</TableCell>
                                    <TableCell>{row.type}</TableCell>
                                    <TableCell>{row.status}</TableCell>
                                    <TableCell>{row.created_at ? format(parseISO(row.created_at), "MMM dd, yyyy HH:mm") : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            default:
                return (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Select a report type to view data.
                    </div>
                );
        }
    };

    return (
        <Card className="col-span-7">
            <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>Generate and view detailed reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                    <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Report Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="client-status">Client Status Report</SelectItem>
                            <SelectItem value="task-progress">Task Progress Report</SelectItem>
                            <SelectItem value="email-activity">Email Activity Report</SelectItem>
                            <SelectItem value="document-overview">Document Overview Report</SelectItem>
                        </SelectContent>
                    </Select>
                    <CalendarDateRangePicker onDateChange={(dateRange) => setDateRange(dateRange || {})} />
                </div>
                <div className="border rounded-md overflow-hidden">
                    {renderReportContent()}
                </div>
            </CardContent>
        </Card>
    );
};


const RecentEmails: React.FC = () => {
    const [recentEmails, setRecentEmails] = useState<any[]>([]); // Replace 'any' with your email type
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchRecentEmails = async () => {
            if (userId) {
                try {
                    const { data, error } = await supabase
                        .from("emails")
                        .select("id, subject, sender, created_at")
                        .eq("user_id", userId)
                        .order("created_at", { ascending: false })
                        .limit(5); // Adjust the limit as needed

                    if (error) {
                        console.error("Error fetching recent emails:", error);
                    } else {
                        setRecentEmails(data);
                    }
                } catch (error) {
                    console.error("An unexpected error occurred:", error);
                }
            }
        };

        fetchRecentEmails();
    }, [userId]);

    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Recent Emails</CardTitle>
                <CardDescription>Latest emails received</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {recentEmails.length > 0 ? (
                    <ul>
                        {recentEmails.map((email) => (
                            <li key={email.id} className="flex items-center space-x-3 py-2">
                                <Avatar>
                                    {/* You might want to use a more specific avatar logic here, e.g., based on sender */}
                                    <AvatarFallback><Mail className="h-5 w-5" /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-sm">
                                    <p className="font-semibold">{email.subject}</p>
                                    <p className="text-muted-foreground">{email.sender}</p>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {email.created_at ? format(parseISO(email.created_at), "MMM dd, HH:mm") : ""}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No recent emails.</p>
                )}
            </CardContent>
        </Card>
    );
};


export default function DashboardPage() {
    return (
        <div className="flex flex-col">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="md:hidden">
                    <MobileNav />
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <div className="flex items-center space-x-2">
                        <CalendarDateRangePicker />
                    </div>
                </div>
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="reports">Reports</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <TotalClientsCard />
                            <PendingTasksCard />
                            <UpcomingMeetingsCard />
                            <UnreadEmailsCard />
                            <TotalDocumentsCard /> {/* New Total Documents Card */}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle>Weekly Activity</CardTitle>
                                </CardHeader>
                                <CardContent className="pl-2">
                                    <Overview />
                                </CardContent>
                            </Card>
                            <RecentEmails /> {/* Dynamic RecentEmails component */}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <UpcomingTasksCard />
                            <ClientDistributionCard />
                        </div>
                    </TabsContent>
                    <TabsContent value="analytics" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <AnalyticsDashboard /> {/* Render the new AnalyticsDashboard component */}
                        </div>
                    </TabsContent>
                    <TabsContent value="reports" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                            <ReportsDashboard /> {/* Render the new ReportsDashboard component */}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
