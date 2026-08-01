"use client";

import { useEffect } from "react";
import { useBootstrap } from "@/hooks/use-api";

/**
 * Applies the tenant's white-label colors as CSS custom properties at
 * runtime. Without branding, the stock Go3net palette stays untouched.
 */
export function BrandingApplier() {
  const { data: session } = useBootstrap();
  const branding = session?.tenant?.branding;

  useEffect(() => {
    const root = document.documentElement;
    if (branding?.primary_color) {
      root.style.setProperty("--primary", branding.primary_color);
      root.style.setProperty("--ring", branding.primary_color);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }
    if (branding?.accent_color) {
      root.style.setProperty("--accent", branding.accent_color);
    } else {
      root.style.removeProperty("--accent");
    }
  }, [branding?.primary_color, branding?.accent_color]);

  return null;
}
