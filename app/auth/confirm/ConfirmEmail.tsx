"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ConfirmEmail() {
  const [loading, setLoading] = useState(true);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const type = searchParams.get("type");
    const emailFromUrl = searchParams.get("email");

    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }

    async function confirmSignUp() {
      if (token && type === "signup" && email) {
        setLoading(true);
        const { error } = await supabase.auth.verifyOtp({ token, type, email });

        if (error) {
          console.error("Email confirmation error:", error);
          setConfirmationError(error.message || "Failed to confirm email.");
          toast({
            title: "Error",
            description: error.message || "Failed to confirm email.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Email confirmed! You can now sign in.",
          });
          router.push("/login");
        }
        setLoading(false);
      } else {
        let errorMessage = "Invalid confirmation link.";
        if (!email) {
          errorMessage = "Invalid confirmation link: Email address missing.";
        }
        setConfirmationError(errorMessage);
        setLoading(false);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }

    confirmSignUp();
  }, [router, searchParams, toast, email]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Confirm Email</CardTitle>
          <CardDescription>Processing email confirmation...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p>Confirming your email address...</p>
          ) : confirmationError ? (
            <p className="text-red-500">{confirmationError}</p>
          ) : (
            <p className="text-green-500">Email confirmed successfully!</p>
          )}
          {!loading && !confirmationError && (
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
