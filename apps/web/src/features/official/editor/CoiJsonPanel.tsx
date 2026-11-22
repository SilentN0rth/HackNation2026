"use client";

import { Button } from "@heroui/react";
import { api } from "@/api";
import { ErrorBox } from "@/components/Feedback";
import { useAsync } from "@/lib/useAsync";

export function CoiJsonPanel({ draftId, fileName, updatedAt }: { draftId: string; fileName: string; updatedAt: string }) {
  const { data: coi, error } = useAsync(() => api.getCoiJson(draftId), [draftId, updatedAt]);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(coi, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      {error && <ErrorBox message={error} />}
      <div>
        <Button size="sm" variant="secondary" isDisabled={!coi} onPress={downloadJson}>
          Pobierz JSON
        </Button>
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-md bg-ink p-5 font-mono text-xs leading-relaxed text-white/85">
        {coi ? JSON.stringify(coi, null, 2) : "Wczytywanie…"}
      </pre>
    </>
  );
}
