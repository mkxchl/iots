// app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login/"); // Redirect ke /login
  }, [router]);

  return null; // Tidak perlu render apapun
}
