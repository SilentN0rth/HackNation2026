import type { Metadata } from "next";
import { ServicesView } from "@/features/citizen/ServicesView";

export const metadata: Metadata = { title: "Usługi" };

export default function Page() {
  return <ServicesView />;
}
