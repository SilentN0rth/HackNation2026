import type { Metadata } from "next";
import { NotFoundView } from "@/features/NotFoundView";

export const metadata: Metadata = { title: "Nie znaleziono" };

export default function NotFound() {
  return <NotFoundView />;
}
