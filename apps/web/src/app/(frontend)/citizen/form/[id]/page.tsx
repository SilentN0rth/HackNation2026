import type { Metadata } from "next";
import { FillFormView } from "@/features/citizen/FillFormView";

export const metadata: Metadata = { title: "Wniosek" };

export default async function Page({ params, searchParams }: PageProps<"/citizen/form/[id]">) {
  const [{ id }, { app }] = await Promise.all([params, searchParams]);
  return <FillFormView formId={id} applicationId={typeof app === "string" ? app : null} />;
}
