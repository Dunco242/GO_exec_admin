import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  email?: string;
  full_name?: string;
}

export function useUserSearch(query: string) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!query.trim()) {
        setUsers([]);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name")
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error("User search error:", error.message);
        setUsers([]);
        return;
      }

      setUsers(data || []);
    };

    fetchUsers();
  }, [query]);

  return { users };
}
