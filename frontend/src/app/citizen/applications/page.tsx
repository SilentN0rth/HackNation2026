import type { Metadata } from "next";
import { MyApplicationsView } from "@/features/citizen/MyApplicationsView";

export const metadata: Metadata = { title: "Twoje sprawy" };

export default function Page() {
  return <MyApplicationsView />;
}
