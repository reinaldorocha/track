"use client";

import { useEffect } from "react";
import { initializeNativePush } from "@/lib/mobile/native-bridge";

export function MobileClientInit() {
  useEffect(() => {
    initializeNativePush();
  }, []);

  return null;
}
