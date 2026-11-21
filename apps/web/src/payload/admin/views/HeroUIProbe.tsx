"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

/** Zaślepka etapu 0 nad dashboardem: dowód, że HeroUI + Tailwind działają w panelu. Agent E ją zastąpi. */
export function HeroUIProbe() {
  const router = useRouter();
  return (
    <div data-testid="heroui-probe" className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-4">
      <p className="text-sm font-semibold uppercase text-accent">Panel urzędnika</p>
      <Button size="sm" variant="primary" onPress={() => router.push("/official/collections/forms/create")}>
        Nowy formularz
      </Button>
    </div>
  );
}
