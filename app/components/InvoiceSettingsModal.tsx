"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card, // Reusing Card for internal styling, though it's inside a Dialog
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InvoiceSettingsModalProps {
  userId: string;
  onClose: () => void;
}

export default function InvoiceSettingsModal({ userId, onClose }: InvoiceSettingsModalProps) {
  const [paypalClientId, setPaypalClientId] = useState<string>("");
  const [paypalClientSecret, setPaypalClientSecret] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // Fetch existing settings for the current user
        const { data, error } = await supabase
          .from("settings")
          .select("paypal_client_id, paypal_client_secret")
          .eq("user_id", userId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means "No rows found"
          console.error("Error fetching settings:", error.message);
          toast({
            title: "Error fetching settings",
            description: error.message,
            variant: "destructive",
          });
        } else if (data) {
          setPaypalClientId(data.paypal_client_id || "");
          setPaypalClientSecret(data.paypal_client_secret || "");
        }
      } catch (error: any) {
        console.error("Unexpected error fetching settings:", error.message);
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) { // Only fetch settings if userId is available
      fetchSettings();
    }
  }, [userId, toast]); // Depend on userId to refetch if it changes

  const handleSaveSettings = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated. Cannot save settings.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upsert (insert or update) the settings for the current user
      const { error } = await supabase
        .from("settings")
        .upsert(
          {
            user_id: userId,
            paypal_client_id: paypalClientId,
            paypal_client_secret: paypalClientSecret,
          },
          { onConflict: 'user_id' } // Conflict on user_id to update existing row
        );

      if (error) {
        console.error("Error saving settings:", error.message);
        toast({
          title: "Error saving settings",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Settings Saved",
          description: "Your PayPal credentials have been updated.",
        });
        onClose(); // Close the modal on successful save
      }
    } catch (error: any) {
      console.error("Unexpected error saving settings:", error.message);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 py-4"> {/* Using grid gap for spacing */}
      <div>
        <Label htmlFor="paypalClientId">PayPal Client ID</Label>
        <Input
          id="paypalClientId"
          type="password"
          value={paypalClientId}
          onChange={(e) => setPaypalClientId(e.target.value)}
          placeholder="Enter your PayPal Client ID"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="paypalClientSecret">PayPal Client Secret</Label>
        <Input
          id="paypalClientSecret"
          type="password"
          value={paypalClientSecret}
          onChange={(e) => setPaypalClientSecret(e.target.value)}
          placeholder="Enter your PayPal Client Secret"
          className="mt-1"
        />
      </div>
      <div className="flex justify-end pt-4"> {/* Footer for buttons */}
        <Button onClick={handleSaveSettings} className="px-6 py-3 text-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
          Save Settings
        </Button>
      </div>
    </div>
  );
}
