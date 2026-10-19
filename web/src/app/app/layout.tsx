import type { Metadata } from "next";
import { buildInitialWorkspace } from "@/lib/demo/initial";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppShell } from "./app-shell";

export const metadata: Metadata = { title: { default: "Workspace", template: "%s · ShelfRelay workspace" } };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const initial = await buildInitialWorkspace();
  return (
    <WorkspaceProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
