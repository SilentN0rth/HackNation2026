import type { Metadata } from "next";
import { UploadView } from "@/features/official/UploadView";

export const metadata: Metadata = { title: "Nowy formularz" };

export default function Page() {
  return <UploadView />;
}
