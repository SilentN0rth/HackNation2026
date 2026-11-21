"use client";

import { AlertDialog, Button } from "@heroui/react";
import type { ReactNode } from "react";

/** Potwierdzenie operacji (usuwanie, publikacja, przywracanie wersji) – HeroUI AlertDialog. */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  tone = "danger",
  busy,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "accent";
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog className="rounded-[10px] border border-border shadow-none" data-testid="confirm-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status={tone === "danger" ? "danger" : "accent"} />
            <AlertDialog.Heading className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="leading-relaxed text-muted">{children}</AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="secondary" slot="close" isDisabled={busy}>
              Anuluj
            </Button>
            <Button variant={tone === "danger" ? "danger" : "primary"} isPending={busy} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
