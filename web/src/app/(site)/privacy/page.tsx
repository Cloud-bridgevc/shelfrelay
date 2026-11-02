import type { Metadata } from "next";
import { GlowPrivacy } from "@/components/Glow";

export const metadata: Metadata = { title: "Privacy notice", description: "Privacy notice for the ShelfRelay website and demo." };

export default function Page() {
  return <GlowPrivacy />;
}
