"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While the worker has something to do, the page re-reads itself every few seconds.
export default function AutoRefresh({ active, everyMs = 4000 }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, router]);
  return null;
}
