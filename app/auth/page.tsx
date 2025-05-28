"use client"

import { useState, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

export default function AuthPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [view, setView] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const { toast } = useToast();

    const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
    const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);
    const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value);

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                toast({
                    title: "Sign In Error",
                    description: error.message,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Success",
                    description: "Signed in successfully!",
                    variant: "default",
                });
                router.push("/"); // Redirect to dashboard
            }
        } catch (e: any) {
            console.error("Unexpected sign-in error:", e);
            toast({
                title: "Error",
                description: e.message || "An unexpected error occurred during sign-in.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (password !== confirmPassword) {
            toast({
                title: "Error",
                description: "Passwords do not match.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                toast({
                    title: "Sign Up Error",
                    description: error.message,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Success",
                    description: "Account created! Please check your email to confirm your account.",
                    variant: "default",
                });
                setView("sign-in"); // Go back to sign-in after successful sign-up
            }
        } catch (e: any) {
            console.error("Unexpected sign-up error:", e);
            toast({
                title: "Error",
                description: e.message || "An unexpected error occurred during sign-up.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth?reset=true`, // Redirect back to auth page after reset
            });

            if (error) {
                toast({
                    title: "Password Reset Error",
                    description: error.message,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Success",
                    description: "Password reset email sent. Please check your inbox.",
                    variant: "default",
                });
                setView("sign-in"); // Go back to sign-in
            }
        } catch (e: any) {
            console.error("Unexpected password reset error:", e);
            toast({
                title: "Error",
                description: e.message || "An unexpected error occurred during password reset.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        {view === "sign-in" && "Sign In"}
                        {view === "sign-up" && "Sign Up"}
                        {view === "forgot-password" && "Forgot Password"}
                    </CardTitle>
                    <CardDescription>
                        {view === "sign-in" && "Enter your credentials to access your account."}
                        {view === "sign-up" && "Create a new account to get started."}
                        {view === "forgot-password" && "Enter your email to receive a password reset link."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            required
                            value={email}
                            onChange={handleEmailChange}
                            disabled={isLoading}
                        />
                    </div>
                    {(view === "sign-in" || view === "sign-up") && (
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={handlePasswordChange}
                                disabled={isLoading}
                            />
                        </div>
                    )}
                    {view === "sign-up" && (
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={handleConfirmPasswordChange}
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    {view === "sign-in" && (
                        <Button onClick={handleSignIn} className="w-full bg-[#2660ff] hover:bg-[#1a4cd1]" disabled={isLoading}>
                            {isLoading ? "Signing In..." : "Sign In"}
                        </Button>
                    )}
                    {view === "sign-up" && (
                        <Button onClick={handleSignUp} className="w-full bg-[#2660ff] hover:bg-[#1a4cd1]" disabled={isLoading}>
                            {isLoading ? "Signing Up..." : "Sign Up"}
                        </Button>
                    )}
                    {view === "forgot-password" && (
                        <Button onClick={handleForgotPassword} className="w-full bg-[#2660ff] hover:bg-[#1a4cd1]" disabled={isLoading}>
                            {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
                        </Button>
                    )}

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                        {view === "sign-in" && (
                            <>
                                Don't have an account?{" "}
                                <Button variant="link" onClick={() => setView("sign-up")} className="p-0 h-auto">
                                    Sign Up
                                </Button>
                                <br />
                                <Button variant="link" onClick={() => setView("forgot-password")} className="p-0 h-auto">
                                    Forgot Password?
                                </Button>
                            </>
                        )}
                        {view === "sign-up" && (
                            <>
                                Already have an account?{" "}
                                <Button variant="link" onClick={() => setView("sign-in")} className="p-0 h-auto">
                                    Sign In
                                </Button>
                            </>
                        )}
                        {view === "forgot-password" && (
                            <>
                                Remember your password?{" "}
                                <Button variant="link" onClick={() => setView("sign-in")} className="p-0 h-auto">
                                    Sign In
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
