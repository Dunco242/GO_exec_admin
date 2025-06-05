// components/hydrated.tsx
"use client";
import { useState, useEffect } from "react";

export function Hydrated({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children}</> : null;
}
