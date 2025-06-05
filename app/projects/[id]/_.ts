import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface Project {
    id?: number;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    client_id?: number | null;
    title: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: string | null;
    priority?: string | null;
    progress?: number | null;
    budget?: number | null;
    estimated_cost?: number | null;
    actual_cost?: number | null;
    calendar_event_id?: number | null;
    primary_document_id?: number | null;
    primary_email_id?: number | null;
    primary_note_id?: number | null;
}

export async function GET(request: Request) {
    // Await the cookies() function
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => Promise.resolve(cookieStore) });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching projects:', error);
            return NextResponse.json({ error: 'Failed to fetch projects', details: error.message }, { status: 500 });
        }

        return NextResponse.json(projects, { status: 200 });
    } catch (error: any) {
        console.error('Unexpected error fetching projects:', error);
        return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    // Await the cookies() function
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => Promise.resolve(cookieStore) });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const newProjectData: Project = await request.json();

        const projectToInsert = {
            ...newProjectData,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: newProjectData.status || 'To Do',
            priority: newProjectData.priority || 'Medium',
            progress: newProjectData.progress !== undefined ? newProjectData.progress : 0,
        };

        const { data: createdProject, error } = await supabase
            .from('projects')
            .insert([projectToInsert])
            .select();

        if (error) {
            console.error('Error creating project:', error);
            return NextResponse.json({ error: 'Failed to create project', details: error.message }, { status: 500 });
        }

        return NextResponse.json(createdProject[0], { status: 201 });
    } catch (error: any) {
        console.error('Unexpected error creating project:', error);
        return NextResponse.json({ error: 'An unexpected error occurred', details: error.message }, { status: 500 });
    }
}
