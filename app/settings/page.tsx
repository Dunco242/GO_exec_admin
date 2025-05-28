"use client"

import { useState, ChangeEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import { MobileNav } from "@/components/mobile-nav"; // Import MobileNav

// Define the structure for email settings stored in the database (matching Supabase table)
interface EmailSettingsData {
    user_id: string | null;
    main_email_address: string | null;
    smtp_server: string | null;
    smtp_port: number | null;
    imap_server: string | null;
    imap_port: number | null;
    pop3_server: string | null;
    pop3_port: number | null;
}

export default function SettingsPage() {
    const { toast } = useToast();
    const router = useRouter();

    // State for email settings (UI state)
    const [emailSettings, setEmailSettings] = useState({
        mainEmailAddress: "",
        emailPassword: "", // UI only, not stored in DB
        smtpServer: "",
        smtpPort: "", // Keep as string for input, convert to number for DB
        imapServer: "",
        imapPort: "", // Keep as string for input, convert to number for DB
        pop3Server: "",
        pop3Port: "", // Keep as string for input, convert to number for DB
    });

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Effect to get the current user's ID from Supabase Auth
    useEffect(() => {
        const getSupabaseUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error) {
                    console.error("Error getting Supabase user:", error);
                    toast({
                        title: "Authentication Error",
                        description: "Failed to get user session from Supabase. Ensure Supabase Auth is configured.",
                        variant: "destructive",
                    });
                    const anonymousId = crypto.randomUUID();
                    setUserId(anonymousId);
                } else if (user) {
                    setUserId(user.id);
                } else {
                    const anonymousId = crypto.randomUUID();
                    setUserId(anonymousId);
                }
            } catch (e) {
                console.error("Unexpected error getting Supabase user:", e);
                const anonymousId = crypto.randomUUID();
                setUserId(anonymousId); // Fallback
            } finally {
                setLoading(false);
            }
        };

        getSupabaseUser();
    }, []); // Run once on component mount

    // Fetch settings when userId is available
    useEffect(() => {
        const fetchSettings = async () => {
            if (!userId) {
                setLoading(true);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', userId)
                    .single(); // Use .single() to expect one row

                if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                    console.error("Error fetching settings from Supabase:", error);
                    toast({
                        title: "Error",
                        description: `Failed to load email settings: ${error.message}`,
                        variant: "destructive",
                    });
                } else if (data) {
                    setEmailSettings({
                        mainEmailAddress: data.main_email_address || "",
                        emailPassword: "", // Never fetch password
                        smtpServer: data.smtp_server || "",
                        smtpPort: data.smtp_port ? String(data.smtp_port) : "",
                        imapServer: data.imap_server || "",
                        imapPort: data.imap_port ? String(data.imap_port) : "",
                        pop3Server: data.pop3_server || "",
                        pop3Port: data.pop3_port ? String(data.pop3_port) : "",
                    });
                    toast({
                        title: "Settings Loaded",
                        description: "Your email settings have been loaded.",
                        variant: "default",
                    });
                } else {
                    setEmailSettings({ // Reset to empty if no settings found
                        mainEmailAddress: "",
                        emailPassword: "",
                        smtpServer: "",
                        smtpPort: "",
                        imapServer: "",
                        imapPort: "",
                        pop3Server: "",
                        pop3Port: "",
                    });
                    toast({
                        title: "No Settings Found",
                        description: "No email settings found. Please configure them.",
                        variant: "default",
                    });
                }
            } catch (error) {
                console.error("An unexpected error occurred while fetching settings:", error);
                toast({
                    title: "Error",
                    description: "An unexpected error occurred while loading email settings.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [userId]); // Depend on userId to trigger fetch once available

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEmailSettings(prev => ({ ...prev, [id]: value }));
    };

    const handleSaveSettings = async () => {
        if (!userId) {
            console.warn("Attempting to save before userId is available.");
            toast({
                title: "Warning",
                description: "User authentication not yet ready. Please try again in a moment.",
                variant: "default",
            });
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave: EmailSettingsData = {
                user_id: userId,
                main_email_address: emailSettings.mainEmailAddress || null,
                smtp_server: emailSettings.smtpServer || null,
                smtp_port: parseInt(emailSettings.smtpPort || "0") || null,
                imap_server: emailSettings.imapServer || null,
                imap_port: parseInt(emailSettings.imapPort || "0") || null,
                pop3_server: emailSettings.pop3Server || null,
                pop3_port: parseInt(emailSettings.pop3Port || "0") || null,
            };

            const { data, error } = await supabase
                .from('user_settings')
                .upsert(dataToSave, { onConflict: 'user_id' });

            if (error) {
                console.error("Error saving settings to Supabase:", error);
                toast({
                    title: "Error",
                    description: `Failed to save email settings: ${error.message}`,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Settings Saved!",
                    description: "Your email account settings have been updated.",
                    variant: "default",
                });
            }
        } catch (error) {
            console.error("An unexpected error occurred while saving settings:", error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while saving email settings.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col">
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="md:hidden">
                    <MobileNav />
                </div>
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="col-span-1">
                        <CardHeader>
                            <CardTitle>Email Account Setup</CardTitle>
                            <CardDescription>Configure your primary email account settings.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center text-muted-foreground">Loading settings...</div>
                            ) : (
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="mainEmailAddress">Main Email Address</Label>
                                        <Input
                                            id="mainEmailAddress"
                                            type="email"
                                            placeholder="your.email@example.com"
                                            value={emailSettings.mainEmailAddress}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="emailPassword">Email Password / App Password</Label>
                                        <Input
                                            id="emailPassword"
                                            type="password"
                                            placeholder="Enter your email password or app-specific password (not stored)"
                                            value={emailSettings.emailPassword}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Note: For security, your email password is not stored. In a real application, consider using OAuth for secure integration.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpServer">SMTP Server</Label>
                                        <Input
                                            id="smtpServer"
                                            type="text"
                                            placeholder="smtp.example.com"
                                            value={emailSettings.smtpServer}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="smtpPort">SMTP Port</Label>
                                        <Input
                                            id="smtpPort"
                                            type="number"
                                            placeholder="587"
                                            value={emailSettings.smtpPort}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="imapServer">IMAP Server</Label>
                                        <Input
                                            id="imapServer"
                                            type="text"
                                            placeholder="imap.example.com"
                                            value={emailSettings.imapServer}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="imapPort">IMAP Port</Label>
                                        <Input
                                            id="imapPort"
                                            type="number"
                                            placeholder="993"
                                            value={emailSettings.imapPort}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    {/* POP3 Settings */}
                                    <div className="space-y-2">
                                        <Label htmlFor="pop3Server">POP3 Server</Label>
                                        <Input
                                            id="pop3Server"
                                            type="text"
                                            placeholder="pop.example.com"
                                            value={emailSettings.pop3Server}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pop3Port">POP3 Port</Label>
                                        <Input
                                            id="pop3Port"
                                            type="number"
                                            placeholder="110"
                                            value={emailSettings.pop3Port}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-[#2660ff] hover:bg-[#1a4cd1]">
                                        {isSaving ? "Saving..." : "Save Email Settings"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
