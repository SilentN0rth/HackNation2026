import type { Metadata } from "next";
import { DashboardView } from "@/features/official/DashboardView";

export const metadata: Metadata = { title: "Formularze" };

export default function Page() {
  return <DashboardView />;
}
