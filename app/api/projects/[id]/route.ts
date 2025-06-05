// app/api/projects/[id]/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const projectId = params.id;

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const updateData = {
      ...body,
      updated_at: new Date().toISOString(),
      budget: body.budget ? parseFloat(body.budget) : 0,
      progress: body.progress ? parseInt(body.progress, 10) : 0,
    };

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: "Failed to update project", details: error.message },
        { status: 500 }
      );
    }

    return Response.json(data, { status: 200 });
  } catch (err) {
    return Response.json(
      { error: "Internal server error", details: err },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const projectId = params.id;

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      return Response.json(
        { error: "Failed to delete project", details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ message: "Project deleted successfully" }, { status: 200 });
  } catch (err) {
    return Response.json(
      { error: "Internal server error", details: err },
      { status: 500 }
    );
  }
}
