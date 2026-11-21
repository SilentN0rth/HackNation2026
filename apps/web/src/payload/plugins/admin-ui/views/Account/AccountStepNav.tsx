"use client";

import { useStepNav } from "@payloadcms/ui";
import { useEffect } from "react";

/** Okruszki Payloada „Panel / Twoje konto” – jak na listach kolekcji. */
export function AccountStepNav() {
  const { setStepNav } = useStepNav();
  useEffect(() => {
    setStepNav([{ label: "Twoje konto" }]);
  }, [setStepNav]);
  return null;
}
