import type { Metadata } from "next";
import { AuditView } from "@/features/official/AuditView";

export const metadata: Metadata = { title: "Dziennik decyzji" };

export default function Page() {
  return <AuditView />;
}
