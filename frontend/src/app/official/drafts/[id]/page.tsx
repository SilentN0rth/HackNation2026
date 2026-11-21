import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Feedback";
import { EditorView } from "@/features/official/EditorView";

export const metadata: Metadata = { title: "Edytor formularza" };

async function Editor({ params }: Pick<PageProps<"/official/drafts/[id]">, "params">) {
  const { id } = await params;
  return <EditorView draftId={id} />;
}

export default function Page({ params }: PageProps<"/official/drafts/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Editor params={params} />
    </Suspense>
  );
}
