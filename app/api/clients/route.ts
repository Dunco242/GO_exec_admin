// app/api/clients/route.ts
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true });

    if (error) {
      return Response.json(
        { error: "Failed to fetch clients", details: error.message },
        { status: 500 }
      );
    }

    return Response.json(data || [], { status: 200 });
  } catch (err) {
    return Response.json(
      { error: "Internal server error", details: err },
      { status: 500 }
    );
  }
}
