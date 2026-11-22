"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { toast, useConfig, useDocumentInfo, useEditDepth, useForm, useFormModified, useFormProcessing, useHotkey } from "@payloadcms/ui";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ShellData } from "./DocumentShell";
import { duration, ease, useSlideUp } from "./motion";

type Kind = "save" | "draft" | "publish";

export function DocumentControls({ shell, drafts, operation }: { shell: ShellData; drafts: boolean; operation: "create" | "update" }) {
  const { submit } = useForm();
  const modified = useFormModified();
  const processing = useFormProcessing();
  const { id, collectionSlug, globalSlug, hasSavePermission, hasPublishPermission, hasDeletePermission, hasPublishedDoc, data } = useDocumentInfo();
  const { config } = useConfig();
  const editDepth = useEditDepth();
  const router = useRouter();
  const slide = useSlideUp();
  const [pending, setPending] = useState<Kind | null>(null);
  const [confirm, setConfirm] = useState<null | "delete" | "unpublish">(null);
  const [busy, setBusy] = useState(false);

  const api = config.routes.api;
  const entityPath = collectionSlug ? `/${collectionSlug}${id ? `/${id}` : ""}` : `/globals/${globalSlug}`;
  const isForms = collectionSlug === "forms";
  const isPublished = (data as { _status?: string } | undefined)?._status === "published" || hasPublishedDoc;
  const canSave = Boolean(hasSavePermission);

  async function run(kind: Kind) {
    setPending(kind);
    try {
      if (kind === "draft") {
        await submit({
          action: `${api}${entityPath}?depth=0&draft=true`,
          method: collectionSlug && !id ? "POST" : collectionSlug ? "PATCH" : "POST",
          overrides: { _status: "draft" },
          skipValidation: true,
        });
      } else if (kind === "publish") {
        await submit({ overrides: { _status: "published", ...(isForms ? { status: "published" } : {}) } });
      } else {
        await submit(drafts ? { overrides: { _status: isPublished ? "published" : "draft" } } : undefined);
      }
    } finally {
      setPending(null);
    }
  }

  useHotkey({ cmdCtrlKey: true, editDepth, keyCodes: ["s"] }, (e) => {
    e.preventDefault();
    if (canSave && !processing) void run(drafts ? "draft" : "save");
  });

  async function request(method: "DELETE" | "PATCH" | "POST", path: string, body?: unknown) {
    const res = await fetch(`${api}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept-Language": "pl" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { doc?: { id: string | number }; message?: string; errors?: { message: string }[] };
    if (!res.ok) throw new Error(json.errors?.[0]?.message ?? json.message ?? `Błąd ${res.status}`);
    return json;
  }

  async function onDelete() {
    setBusy(true);
    try {
      await request("DELETE", entityPath);
      toast.success("Usunięto dokument.");
      router.push(`${config.routes.admin}/collections/${collectionSlug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function onUnpublish() {
    setBusy(true);
    try {
      await request("PATCH", `${entityPath}?depth=0`, { _status: "draft", ...(isForms ? { status: "draft" } : {}) });
      toast.success("Wycofano publikację.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function onDuplicate() {
    try {
      const json = await request("POST", `${entityPath}/duplicate?depth=0`);
      toast.success("Utworzono kopię.");
      if (json.doc?.id) router.push(`${config.routes.admin}/collections/${collectionSlug}/${json.doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const showMore = operation === "update" && collectionSlug && id;

  return (
    <>
      <motion.div
        {...slide}
        className="sticky bottom-4 z-30 mt-14"
        role="toolbar"
        aria-label="Akcje dokumentu"
        data-testid="document-controls"
      >
        <motion.div
          animate={{ borderColor: modified ? "#0d0e0e" : "#c9cacc" }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="flex w-full flex-wrap items-center gap-3 rounded-[10px] border bg-white px-4 py-3"
        >
          <p className="mr-auto flex min-w-0 items-center gap-2 text-sm" aria-live="polite" data-testid="document-state">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={modified ? "dirty" : "clean"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: duration.fast, ease: ease.out }}
                className="inline-flex items-center gap-2"
              >
                <span aria-hidden className={`size-1.5 rounded-full ${modified ? "pulse-dot bg-accent" : "bg-success"}`} />
                <span className={modified ? "font-semibold text-ink" : "text-muted"}>
                  {modified ? "Niezapisane zmiany" : operation === "create" ? "Nowy dokument" : shell.meta.updatedAt ? `Zapisano ${shell.meta.updatedAt}` : "Zapisano"}
                </span>
              </motion.span>
            </AnimatePresence>
          </p>

          {showMore && (
            <Dropdown>
              <Button variant="ghost" size="sm" aria-label="Więcej akcji" data-testid="document-more">
                Więcej
              </Button>
              <Dropdown.Popover className="min-w-48" placement="top end">
                <Dropdown.Menu
                  aria-label="Więcej akcji"
                  onAction={(key) => {
                    if (key === "duplicate") void onDuplicate();
                    if (key === "delete") setConfirm("delete");
                    if (key === "unpublish") setConfirm("unpublish");
                    if (key === "versions") router.push(`${shell.base}/versions`);
                  }}
                >
                  {[
                    ...(shell.tabs.some((t) => t.id === "versions") ? [<Dropdown.Item key="versions" id="versions" textValue="Wersje"><Label>Historia wersji</Label></Dropdown.Item>] : []),
                    <Dropdown.Item key="duplicate" id="duplicate" textValue="Duplikuj">
                      <Label>Duplikuj</Label>
                    </Dropdown.Item>,
                    ...(drafts && isPublished && hasPublishPermission
                      ? [<Dropdown.Item key="unpublish" id="unpublish" textValue="Wycofaj publikację"><Label>Wycofaj publikację</Label></Dropdown.Item>]
                      : []),
                    ...(hasDeletePermission
                      ? [<Dropdown.Item key="delete" id="delete" textValue="Usuń" variant="danger" data-testid="document-delete"><Label>Usuń</Label></Dropdown.Item>]
                      : []),
                  ]}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}

          {canSave &&
            (drafts ? (
              <>
                <Button variant="secondary" isPending={pending === "draft"} isDisabled={processing || (operation === "update" && !modified)} onPress={() => void run("draft")} data-testid="save-draft">
                  Zapisz wersję roboczą
                </Button>
                {hasPublishPermission && (
                  <Button variant="primary" isPending={pending === "publish"} isDisabled={processing} onPress={() => void run("publish")} data-testid="publish">
                    {isPublished ? "Opublikuj zmiany" : "Opublikuj"}
                  </Button>
                )}
              </>
            ) : (
              <Button variant="primary" isPending={pending === "save"} isDisabled={processing || (operation === "update" && !modified)} onPress={() => void run("save")} data-testid="save">
                Zapisz
              </Button>
            ))}
        </motion.div>
      </motion.div>

      <ConfirmDialog
        isOpen={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "delete" ? "Usunąć dokument?" : "Wycofać publikację?"}
        confirmLabel={confirm === "delete" ? "Usuń" : "Wycofaj"}
        tone={confirm === "delete" ? "danger" : "accent"}
        busy={busy}
        onConfirm={() => void (confirm === "delete" ? onDelete() : onUnpublish())}
      >
        {confirm === "delete"
          ? `„${shell.title}” zostanie trwale usunięty. Tej operacji nie można cofnąć.`
          : "Dokument przestanie być dostępny publicznie i wróci do wersji roboczej."}
      </ConfirmDialog>
    </>
  );
}
