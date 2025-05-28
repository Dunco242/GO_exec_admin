"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

interface WeeklyActivityData {
    name: string;
    tasks: number;
    emails: number;
    meetings: number;
    documents: number;
}

export function Overview() {
    const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityData[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        };
        getUserId();
    }, []);

    useEffect(() => {
        const fetchWeeklyActivity = async () => {
            if (!userId) return;

            const today = new Date();
            const start = startOfWeek(today, { weekStartsOn: 0 }); // 0 for Sunday, 1 for Monday
            const end = endOfWeek(today, { weekStartsOn: 0 });

            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const initialWeeklyData: WeeklyActivityData[] = daysOfWeek.map(day => ({
                name: day,
                tasks: 0,
                emails: 0,
                meetings: 0,
                documents: 0,
            }));

            try {
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('id, created_at')
                    .eq('user_id', userId)
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());

                if (tasksError) console.error("Error fetching weekly tasks:", tasksError);

                const { data: emailsData, error: emailsError } = await supabase
                    .from('emails')
                    .select('id, sent_at')
                    .eq('user_id', userId)
                    .gte('sent_at', start.toISOString())
                    .lte('sent_at', end.toISOString());

                if (emailsError) console.error("Error fetching weekly emails:", emailsError);

                const { data: meetingsData, error: meetingsError } = await supabase
                    .from('calendar_events')
                    .select('id, date')
                    .gte('date', format(start, 'yyyy-MM-dd'))
                    .lte('date', format(end, 'yyyy-MM-dd'));

                if (meetingsError) console.error("Error fetching weekly meetings:", meetingsError);

                const { data: documentsData, error: documentsError } = await supabase
                    .from('documents')
                    .select('id, created_at')
                    .eq('user_id', userId)
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());

                if (documentsError) console.error("Error fetching weekly documents:", documentsError);

                const updatedWeeklyData = initialWeeklyData.map(dayData => {
                    const dayIndex = daysOfWeek.indexOf(dayData.name);
                    const currentDate = new Date(start);
                    currentDate.setDate(start.getDate() + dayIndex);
                    const formattedDate = format(currentDate, 'yyyy-MM-dd');

                    const tasksOnDay = tasksData?.filter(task => format(parseISO(task.created_at), 'yyyy-MM-dd') === formattedDate).length || 0;
                    const emailsOnDay = emailsData?.filter(email => format(parseISO(email.sent_at), 'yyyy-MM-dd') === formattedDate).length || 0;
                    const meetingsOnDay = meetingsData?.filter(meeting => meeting.date === formattedDate).length || 0;
                    const documentsOnDay = documentsData?.filter(document => format(parseISO(document.created_at), 'yyyy-MM-dd') === formattedDate).length || 0;

                    return {
                        ...dayData,
                        tasks: tasksOnDay,
                        emails: emailsOnDay,
                        meetings: meetingsOnDay,
                        documents: documentsOnDay,
                    };
                });

                setWeeklyActivity(updatedWeeklyData);

            } catch (error) {
                console.error("An unexpected error occurred while fetching weekly activity:", error);
            }
        };

        fetchWeeklyActivity();
    }, [userId]);

    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={weeklyActivity}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#2660ff" radius={[4, 4, 0, 0]} name="Tasks" />
                <Bar dataKey="emails" fill="#8da9ff" radius={[4, 4, 0, 0]} name="Emails" />
                <Bar dataKey="meetings" fill="#c7d4ff" radius={[4, 4, 0, 0]} name="Meetings" />
                <Bar dataKey="documents" fill="#e0e7ff" radius={[4, 4, 0, 0]} name="Documents" />
            </BarChart>
        </ResponsiveContainer>
    );
}
