import type { Metadata } from "next";
import { HomeView } from "@/features/HomeView";

export const metadata: Metadata = { title: { absolute: "Start · e-Formularze" } };

export default function Page() {
  return <HomeView />;
}
