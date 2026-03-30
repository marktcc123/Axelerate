"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShopPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=shop");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <span className="text-gray-500 text-sm">Loading...</span>
    </div>
  );
}
