import type { Metadata } from "next";
import { EditorView } from "@/features/official/EditorView";

export const metadata: Metadata = { title: "Edytor formularza" };

export default async function Page({ params }: PageProps<"/official/drafts/[id]">) {
  const { id } = await params;
  return <EditorView key={id} draftId={id} />;
}
