import type { Metadata } from "next";
import { BrandingClient } from "./branding-client";

export const metadata: Metadata = { title: "Branding" };

export default function BrandingPage() {
  return <BrandingClient />;
}
