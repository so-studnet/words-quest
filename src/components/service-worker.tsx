"use client";

import { useEffect } from "react";

/** Registers /sw.js once per page load (needed for push notifications). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
      console.warn("[sw] registration failed", e);
    });
  }, []);
  return null;
}
