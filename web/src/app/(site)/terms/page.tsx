import type { Metadata } from "next";
import { GlowTerms } from "@/components/Glow";

export const metadata: Metadata = { title: "Terms of use", description: "Terms of use for the ShelfRelay website and demo." };

export default function Page() {
  return <GlowTerms />;
}
