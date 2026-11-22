"use client";

import { Button, Skeleton } from "@heroui/react";
import { useEffect, useState } from "react";
import { docOf, errorText, rest } from "../lib/rest";
import { Notice } from "../ui/bits";

export function CoiJsonPanel({ formId, fileName, revision }: { formId: number; fileName: string; revision: string }) {
  const [coi, setCoi] = useState<unknown>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    rest(`/forms/${formId}`, {}, { draft: true, depth: 0 })
      .then((body) => alive && setCoi(docOf<{ coiJson?: unknown }>(body).coiJson ?? null))
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [formId, revision]);

  const download = () => {
    const blob = new Blob([JSON.stringify(coi, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Notice message={error} />}
      <div>
        <Button size="sm" variant="secondary" isDisabled={coi === undefined} onPress={download}>
          Pobierz JSON
        </Button>
      </div>
      {coi === undefined ? (
        <Skeleton className="h-64 rounded-md" />
      ) : (
        <pre className="m-0 max-h-[60vh] overflow-auto rounded-md bg-ink p-5 font-mono text-xs leading-relaxed text-white/85">
          {JSON.stringify(coi, null, 2)}
        </pre>
      )}
    </div>
  );
}
