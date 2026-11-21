import { useParams, useSearchParams } from "react-router";
import { FillFormView } from "@/features/citizen/FillFormView";
import { EditorView } from "@/features/official/EditorView";

export function EditorRoute() {
  const { id = "" } = useParams();
  return <EditorView key={id} draftId={id} />;
}

export function FillFormRoute() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  return <FillFormView formId={id} applicationId={params.get("app")} />;
}
