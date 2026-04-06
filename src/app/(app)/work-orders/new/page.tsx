"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /work-orders/new redirects to the work orders page with ?create=1
 * so the create form scrolls into view automatically.
 */
export default function NewWorkOrderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/work-orders?create=1");
  }, [router]);

  return null;
}
