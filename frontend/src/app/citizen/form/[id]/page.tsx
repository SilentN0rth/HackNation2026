import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Feedback";
import { FillFormView } from "@/features/citizen/FillFormView";

export const metadata: Metadata = { title: "Wniosek" };

async function Form({ params, searchParams }: PageProps<"/citizen/form/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const app = typeof sp.app === "string" ? sp.app : null;
  return <FillFormView formId={id} applicationId={app} />;
}

export default function Page(props: PageProps<"/citizen/form/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Form {...props} />
    </Suspense>
  );
}
