"use client";

import { useStepNav } from "@payloadcms/ui";
import { useEffect } from "react";

export function AccountStepNav() {
  const { setStepNav } = useStepNav();
  useEffect(() => {
    setStepNav([{ label: "Twoje konto" }]);
  }, [setStepNav]);
  return null;
}
