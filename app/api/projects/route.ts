// app/api/projects/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      return Response.json(
        { error: "Failed to fetch projects", details: error.message },
        { status: 500 }
      );
    }

    return Response.json(data || []);
  } catch (err) {
    return Response.json(
      { error: "Internal server error", details: err },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const newProject = {
      ...body,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      progress: body.progress !== undefined ? body.progress : 0,
      budget: body.budget !== undefined ? body.budget : 0,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert([newProject])
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: "Failed to create project", details: error.message },
        { status: 500 }
      );
    }

    return Response.json(data, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: "Unexpected error", details: err },
      { status: 500 }
    );
  }
}
