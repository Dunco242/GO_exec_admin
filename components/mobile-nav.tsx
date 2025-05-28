"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Mail, Users, CheckSquare, BarChart3, Bell, Settings, LogOut, FileUp, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

const navItems = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Email", href: "/email", icon: Mail },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Import", href: "/import", icon: FileUp },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter(); // Initialize useRouter
    const [isOpen, setIsOpen] = useState(false); // State to manage sheet open/close

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
                    {/* Added SheetTitle for accessibility */}
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-[#2660ff] p-1.5 text-white">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <h1 className="text-xl font-bold">GO Admin. CRM</h1>
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
                            onClick={() => setIsOpen(false)} // Close sheet on navigation
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
                <div className="px-3 mt-6">
                    <div className="flex items-center gap-3 p-3 rounded-md border dark:border-gray-800">
                        <Avatar>
                            <AvatarImage src="/placeholder.svg?height=40&width=40" alt="User" />
                            <AvatarFallback>VA</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Sarah Johnson</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Virtual Assistant</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-gray-500" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                            <span className="sr-only">Log out</span>
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
