"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HistoryRoutePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?page=history");
  }, [router]);

  return null;
}
