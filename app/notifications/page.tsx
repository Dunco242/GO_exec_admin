"use client"

import { useState, useEffect, useCallback, ChangeEvent } from "react"
import { Bell, Check, Clock, Info, MessageSquare, X, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { MobileNav } from "@/components/mobile-nav"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from '@/lib/supabaseClient';
import { format, formatDistanceToNowStrict } from 'date-fns';

// Define Notification interface to match Supabase schema
interface Notification {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string; // ISO string
  read_at: string | null; // ISO string, null if unread
  type: "message" | "task" | "calendar" | "email" | "system";
  priority: "high" | "medium" | "low";
  link: string | null; // Optional URL
  metadata: any | null; // JSONB for extra data
}

// Define Notification Settings interface to match Supabase schema
interface NotificationSettings {
  id?: number; // Primary key, optional for upsert
  user_id: string;
  email_notifications_enabled: boolean;
  task_notifications_enabled: boolean;
  meeting_reminders_enabled: boolean;
  client_messages_enabled: boolean;
  system_updates_enabled: boolean;
  desktop_notifications_enabled: boolean;
  sound_alerts_enabled: boolean;
  dnd_enabled: boolean;
  dnd_from_time: string | null; // e.g., "22:00"
  dnd_to_time: string | null;   // e.g., "06:00"
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Default notification settings state (will be overwritten by fetched data)
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: '', // Will be set by useEffect
    email_notifications_enabled: true,
    task_notifications_enabled: true,
    meeting_reminders_enabled: true,
    client_messages_enabled: true,
    system_updates_enabled: false,
    desktop_notifications_enabled: true,
    sound_alerts_enabled: false,
    dnd_enabled: false,
    dnd_from_time: '22:00',
    dnd_to_time: '06:00',
  });

  // Fetch user ID on component mount
  useEffect(() => {
    const getSupabaseUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting Supabase user:", error);
        toast({ title: "Authentication Error", description: "Failed to get user session.", variant: "destructive" });
        setUserId(null); // Explicitly set to null if error or no user
      } else if (user) {
        setUserId(user.id);
        setSettings(prev => ({ ...prev, user_id: user.id })); // Set user_id in settings default
      } else {
        setUserId(null); // No user logged in
      }
      setLoadingNotifications(false); // Assume initial load of notifications is done if no user
      setLoadingSettings(false); // Assume initial load of settings is done if no user
    };
    getSupabaseUser();
  }, [toast]);

  // Fetch notifications for the current user
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setActiveNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        toast({ title: 'Error', description: 'Failed to fetch notifications.', variant: 'destructive' });
        setActiveNotifications([]);
      } else {
        setActiveNotifications(data as Notification[]);
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching notifications:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred while fetching notifications.', variant: 'destructive' });
    } finally {
      setLoadingNotifications(false);
    }
  }, [userId, toast]);

  // Fetch notification settings for the current user
  const fetchSettings = useCallback(async () => {
    if (!userId) {
      setLoadingSettings(false);
      return;
    }

    setLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select(`
          id,
          user_id,
          email_notifications_enabled,
          task_notifications_enabled,
          meeting_reminders_enabled,
          client_messages_enabled,
          system_updates_enabled,
          desktop_notifications_enabled,
          sound_alerts_enabled,
          dnd_enabled,
          dnd_from_time,
          dnd_to_time
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error("Error fetching settings:", error);
        toast({ title: 'Error', description: 'Failed to fetch notification settings.', variant: 'destructive' });
      } else if (data) {
        setSettings(data as NotificationSettings);
      } else {
        // If no settings found, initialize default settings in DB for this user
        const defaultSettings = {
          user_id: userId,
          email_notifications_enabled: true,
          task_notifications_enabled: true,
          meeting_reminders_enabled: true,
          client_messages_enabled: true,
          system_updates_enabled: false,
          desktop_notifications_enabled: true,
          sound_alerts_enabled: false,
          dnd_enabled: false,
          dnd_from_time: '22:00',
          dnd_to_time: '06:00',
        };
        const { error: insertError } = await supabase.from('user_settings').insert([defaultSettings]);
        if (insertError) {
          console.error("Error inserting default settings:", insertError);
          toast({ title: 'Error', description: 'Failed to save default settings.', variant: 'destructive' });
        } else {
          setSettings(defaultSettings); // Set local state to defaults if inserted
        }
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching settings:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred while fetching settings.', variant: 'destructive' });
    } finally {
      setLoadingSettings(false);
    }
  }, [userId, toast]);

  // Fetch data when userId changes
  useEffect(() => {
    if (userId) {
      fetchNotifications();
      fetchSettings();
    }
  }, [userId, fetchNotifications, fetchSettings]);

  // Mark notification as read
  const markAsRead = async (id: number) => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error("Error marking as read:", error);
        toast({ title: 'Error', description: 'Failed to mark notification as read.', variant: 'destructive' });
      } else {
        setActiveNotifications(
          activeNotifications.map((notification) =>
            notification.id === id ? { ...notification, read_at: new Date().toISOString() } : notification,
          ),
        );
        toast({ title: 'Success', description: 'Notification marked as read.' });
      }
    } catch (error) {
      console.error("An unexpected error occurred while marking as read:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }
  };

  // Dismiss notification
  const dismissNotification = async (id: number) => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error("Error dismissing notification:", error);
        toast({ title: 'Error', description: 'Failed to dismiss notification.', variant: 'destructive' });
      } else {
        setActiveNotifications(activeNotifications.filter((notification) => notification.id !== id));
        toast({ title: 'Success', description: 'Notification dismissed.' });
      }
    } catch (error) {
      console.error("An unexpected error occurred while dismissing notification:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }
  };

  // Toggle notification setting
  const toggleSetting = async (key: keyof NotificationSettings) => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    const newValue = !settings[key];
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [key]: newValue })
        .eq('user_id', userId);

      if (error) {
        console.error(`Error updating setting ${key}:`, error);
        toast({ title: 'Error', description: `Failed to update setting: ${error.message}`, variant: 'destructive' });
      } else {
        setSettings(prev => ({ ...prev, [key]: newValue }));
        toast({ title: 'Success', description: 'Setting updated successfully.' });
      }
    } catch (error) {
      console.error("An unexpected error occurred while updating setting:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }
  };

  const handleDNDTimeChange = async (type: 'from' | 'to', value: string) => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    const updateKey = type === 'from' ? 'dnd_from_time' : 'dnd_to_time';
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [updateKey]: value })
        .eq('user_id', userId);

      if (error) {
        console.error(`Error updating DND time ${updateKey}:`, error);
        toast({ title: 'Error', description: `Failed to update DND time: ${error.message}`, variant: 'destructive' });
      } else {
        setSettings(prev => ({ ...prev, [updateKey]: value }));
        toast({ title: 'Success', description: 'DND time updated.' });
      }
    } catch (error) {
      console.error("An unexpected error occurred while updating DND time:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }
  };


  // Mark all unread notifications as read
  const markAllAsRead = async () => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null); // Only mark unread ones

      if (error) {
        console.error("Error marking all as read:", error);
        toast({ title: 'Error', description: 'Failed to mark all notifications as read.', variant: 'destructive' });
      } else {
        setActiveNotifications(
          activeNotifications.map((notification) =>
            notification.read_at === null ? { ...notification, read_at: new Date().toISOString() } : notification,
          ),
        );
        toast({ title: 'Success', description: 'All notifications marked as read.' });
      }
    } catch (error) {
      console.error("An unexpected error occurred while marking all as read:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    }
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-5 w-5 text-[#2660ff]" />;
      case "task":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "calendar":
        return <Bell className="h-5 w-5 text-purple-500" />;
      case "email":
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "system":
        return <Info className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Count unread notifications
  const unreadCount = activeNotifications.filter((notification) => !notification.read_at).length;

  const allNotifications = activeNotifications;
  const unreadNotifications = activeNotifications.filter((notification) => !notification.read_at);

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p>Loading notifications...</p>
    </div>
  );

  const renderNoNotifications = (message: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Bell className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">{message}</h3>
      <p className="text-sm text-muted-foreground mt-1">Check back later for updates.</p>
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="md:hidden">
          <MobileNav />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0 || loadingNotifications}>
            <Check className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </div>

        <Tabs defaultValue="all">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">
                All
                {unreadCount > 0 && <Badge className="ml-2 bg-[#2660ff]">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>All Notifications</CardTitle>
                <CardDescription>View and manage all your notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-4">
                    {loadingNotifications ? renderLoading() : (
                      allNotifications.length > 0 ? (
                        allNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`flex items-start space-x-4 rounded-md p-3 transition-colors hover:bg-muted/50 ${
                              !notification.read_at ? "bg-muted/30" : ""
                            }`}
                          >
                            <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{notification.title}</p>
                                <div className="flex items-center gap-2">
                                  {!notification.read_at && <Badge className="bg-[#2660ff]">New</Badge>}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => dismissNotification(notification.id)}
                                  >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Dismiss</span>
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{notification.description}</p>
                              <div className="flex items-center justify-between pt-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                                {!notification.read_at && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-[#2660ff]"
                                    onClick={() => markAsRead(notification.id)}
                                  >
                                    Mark as read
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        renderNoNotifications("No notifications to display.")
                      )
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="unread" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Unread Notifications</CardTitle>
                <CardDescription>View and manage your unread notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-4">
                    {loadingNotifications ? renderLoading() : (
                      unreadNotifications.length > 0 ? (
                        unreadNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="flex items-start space-x-4 rounded-md p-3 transition-colors hover:bg-muted/50 bg-muted/30"
                          >
                            <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{notification.title}</p>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-[#2660ff]">New</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => dismissNotification(notification.id)}
                                  >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Dismiss</span>
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{notification.description}</p>
                              <div className="flex items-center justify-between pt-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-[#2660ff]"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  Mark as read
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Check className="h-12 w-12 text-green-500 mb-4" />
                          <h3 className="text-lg font-medium">All caught up!</h3>
                          <p className="text-sm text-muted-foreground mt-1">You have no unread notifications</p>
                        </div>
                      )
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Manage your notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSettings ? renderLoading() : (
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Email Notifications</h3>
                          <p className="text-sm text-muted-foreground">Receive notifications for new emails</p>
                        </div>
                        <Switch
                          checked={settings.email_notifications_enabled}
                          onCheckedChange={() => toggleSetting('email_notifications_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Task Notifications</h3>
                          <p className="text-sm text-muted-foreground">Receive notifications for task updates and deadlines</p>
                        </div>
                        <Switch
                          checked={settings.task_notifications_enabled}
                          onCheckedChange={() => toggleSetting('task_notifications_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Meeting Reminders</h3>
                          <p className="text-sm text-muted-foreground">Receive reminders for upcoming meetings</p>
                        </div>
                        <Switch
                          checked={settings.meeting_reminders_enabled}
                          onCheckedChange={() => toggleSetting('meeting_reminders_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Client Messages</h3>
                          <p className="text-sm text-muted-foreground">Receive notifications for new client messages</p>
                        </div>
                        <Switch
                          checked={settings.client_messages_enabled}
                          onCheckedChange={() => toggleSetting('client_messages_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">System Updates</h3>
                          <p className="text-sm text-muted-foreground">Receive notifications for system updates</p>
                        </div>
                        <Switch
                          checked={settings.system_updates_enabled}
                          onCheckedChange={() => toggleSetting('system_updates_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Desktop Notifications</h3>
                          <p className="text-sm text-muted-foreground">Show notifications on your desktop</p>
                        </div>
                        <Switch
                          checked={settings.desktop_notifications_enabled}
                          onCheckedChange={() => toggleSetting('desktop_notifications_enabled')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">Sound Alerts</h3>
                          <p className="text-sm text-muted-foreground">Play sound when notifications arrive</p>
                        </div>
                        <Switch
                          checked={settings.sound_alerts_enabled}
                          onCheckedChange={() => toggleSetting('sound_alerts_enabled')}
                        />
                      </div>

                      <Separator className="my-4" />
                      <div className="space-y-4">
                        <h3 className="text-base font-medium">Notification Schedule</h3>
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm">Do Not Disturb</p>
                            <Switch
                              checked={settings.dnd_enabled}
                              onCheckedChange={() => toggleSetting('dnd_enabled')}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            When enabled, notifications will be muted during the specified hours
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="dnd-from-time" className="text-sm font-medium">From</Label>
                            <select
                              id="dnd-from-time"
                              value={settings.dnd_from_time || '22:00'}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) => handleDNDTimeChange('from', e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, '0');
                                return <option key={hour} value={`${hour}:00`}>{`${hour}:00`}</option>;
                              })}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dnd-to-time" className="text-sm font-medium">To</Label>
                            <select
                              id="dnd-to-time"
                              value={settings.dnd_to_time || '06:00'}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) => handleDNDTimeChange('to', e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, '0');
                                return <option key={hour} value={`${hour}:00`}>{`${hour}:00`}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
