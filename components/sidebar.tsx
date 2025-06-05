"use client";

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
// Import FolderKanban icon for Projects and FilePlus for Invoices
import { Calendar, Mail, Users, CheckSquare, BarChart3, Bell, Settings, LogOut, FileUp, Menu, FileText, FolderKanban, FilePlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

const navItems = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Email", href: "/email", icon: Mail },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Projects", href: "/projects", icon: FolderKanban }, // Added Projects tab
    { name: "Invoices", href: "/invoices", icon: FilePlus },     // Added Invoices tab
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Documents", href: "/documents", icon: FileText },
    { name: "Notes", href: "/notes", icon: FileText }, // Added Notes tab
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter();

    // State for logged-in user's info
    const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null);
    const [loggedInUserEmail, setLoggedInUserEmail] = useState<string | null>(null);
    const [loggedInUserInitials, setLoggedInUserInitials] = useState<string | null>(null);
    const [loggedInUserAvatar, setLoggedInUserAvatar] = useState<string | null>(null);

    // Effect to get logged-in user's information on component mount
    useEffect(() => {
        const getUserInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setLoggedInUserName(user.user_metadata?.full_name || user.email || "User");
                setLoggedInUserEmail(user.email || null);
                setLoggedInUserInitials(user.user_metadata?.full_name ? user.user_metadata.full_name.substring(0, 2).toUpperCase() : user.email ? user.email.substring(0, 2).toUpperCase() : '?');
                setLoggedInUserAvatar(user.user_metadata?.avatar_url || null);
            } else {
                // Clear user info if not logged in
                setLoggedInUserName(null);
                setLoggedInUserEmail(null);
                setLoggedInUserInitials(null);
                setLoggedInUserAvatar(null);
            }
        };

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                getUserInfo();
            }
        });

        getUserInfo(); // Initial fetch

        return () => {
            authListener.subscription.unsubscribe(); // Cleanup subscription
        };
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error.message);
            // Optionally show a toast error
        } else {
            router.push("/auth"); // Redirect to auth page after logout
        }
    };

    return (
        <div className="hidden md:flex md:flex-col md:w-64 md:bg-white md:border-r md:dark:bg-gray-950 md:dark:border-gray-800">
            <div className="p-4 border-b dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="rounded-md bg-[#2660ff] p-1.5 text-white">
                        <BarChart3 className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-bold">VA CRM</h1>
                </div>
            </div>
            <div className="flex flex-col justify-between flex-1 py-4">
                <nav className="space-y-1 px-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                                pathname === item.href
                                    ? "bg-[#2660ff] text-white"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
                <div className="px-3 mt-6">
                    <div className="flex items-center gap-3 p-3 rounded-md border dark:border-gray-800">
                        <Avatar>
                            <AvatarImage src={loggedInUserAvatar || "/placeholder.svg?height=40&width=40"} alt={loggedInUserName || "User"} />
                            <AvatarFallback>{loggedInUserInitials || "VA"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{loggedInUserName || "User"}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{loggedInUserEmail || "Guest"}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-gray-500" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                            <span className="sr-only">Log out</span>
                        </Button>
                    </div>
                    {/* "Powered by" logo */}
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Powered by</p>
                        {/* Updated src to point to the recommended public/images path */}
                        <img
                            src="/logo.png" // <--- UPDATED PATH HERE
                            alt="Powered by Logo"
                            className="mx-auto h-8 object-contain"
                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x30/cccccc/333333?text=LogoError'; }} // Fallback
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// MobileNav component (likely located in components/mobile-nav.tsx)
export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    // State for logged-in user's info
    const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null);
    const [loggedInUserEmail, setLoggedInUserEmail] = useState<string | null>(null);
    const [loggedInUserInitials, setLoggedInUserInitials] = useState<string | null>(null);
    const [loggedInUserAvatar, setLoggedInUserAvatar] = useState<string | null>(null);

    // Effect to get logged-in user's information on component mount
    useEffect(() => {
        const getUserInfo = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setLoggedInUserName(user.user_metadata?.full_name || user.email || "User");
                setLoggedInUserEmail(user.email || null);
                setLoggedInUserInitials(user.user_metadata?.full_name ? user.user_metadata.full_name.substring(0, 2).toUpperCase() : user.email ? user.email.substring(0, 2).toUpperCase() : '?');
                setLoggedInUserAvatar(user.user_metadata?.avatar_url || null);
            } else {
                // Clear user info if not logged in
                setLoggedInUserName(null);
                setLoggedInUserEmail(null);
                setLoggedInUserInitials(null);
                setLoggedInUserAvatar(null);
            }
        };

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                getUserInfo();
            }
        });

        getUserInfo(); // Initial fetch

        return () => {
            authListener.subscription.unsubscribe(); // Cleanup subscription
        };
    }, []);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error.message);
            // Optionally show a toast error
        } else {
            setIsOpen(false); // Close the mobile nav sheet
            router.push("/auth"); // Redirect to auth page after logout
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 sm:max-w-xs">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-[#2660ff] p-1.5 text-white">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <h1 className="text-xl font-bold">VA CRM</h1>
                    </div>
                </SheetHeader>
                <nav className="flex flex-col p-2 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                                pathname === item.href
                                    ? "bg-[#2660ff] text-white"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                            )}
                            onClick={() => setIsOpen(false)}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
                <div className="px-3 mt-6">
                    <div className="flex items-center gap-3 p-3 rounded-md border dark:border-gray-800">
                        <Avatar>
                            <AvatarImage src={loggedInUserAvatar || "/placeholder.svg?height=40&width=40"} alt={loggedInUserName || "User"} />
                            <AvatarFallback>{loggedInUserInitials || "VA"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{loggedInUserName || "User"}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{loggedInUserEmail || "Guest"}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-gray-500" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                            <span className="sr-only">Log out</span>
                        </Button>
                    </div>
                    {/* "Powered by" logo */}
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Powered by</p>
                        {/* Updated src to point to the recommended public/images path */}
                        <img
                            src="/logo.png" // <--- UPDATED PATH HERE
                            alt="Powered by Logo"
                            className="mx-auto h-8 object-contain"
                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x30/cccccc/333333?text=LogoError'; }} // Fallback
                        />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
