"use client";

import { useAuth } from "@payloadcms/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { primaryLink } from "../../theme";

export function LogoutClient({ loginHref }: { loginHref: string }) {
  const { logOut } = useAuth();
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logOut().finally(() => setDone(true));
  }, [logOut]);

  return (
    <div className="flex flex-col items-start gap-6" aria-live="polite">
      <p className="text-ink-2">{done ? "Wylogowano. Możesz zamknąć kartę albo zalogować się ponownie." : "Wylogowujemy…"}</p>
      {done && (
        <Link href={loginHref} className={primaryLink}>
          Zaloguj się ponownie
        </Link>
      )}
    </div>
  );
}
