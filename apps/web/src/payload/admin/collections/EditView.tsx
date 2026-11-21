"use client";

/**
 * Edycja dokumentu (kolekcja albo global). Logika jak w DefaultEditView Payloada: Form + getFormState
 * (warunki, walidacja po stronie serwera) + onSuccess (przekierowanie po utworzeniu, odświeżenie danych).
 * Pola renderuje RenderFields – komponenty pól HeroUI agenta D podpinają się przez admin.components.Field.
 */
import {
  Form,
  OperationProvider,
  RenderFields,
  useConfig,
  useDocumentEvents,
  useDocumentInfo,
  useRouteTransition,
  useServerFunctions,
} from "@payloadcms/ui";
import type { ClientField, FormState } from "payload";
import { fieldIsSidebar } from "payload/shared";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { AuthPanel } from "./AuthPanel";
import { DocumentControls } from "./DocumentControls";
import type { ShellData } from "./DocumentShell";
import { useRise } from "./motion";
import { UnsavedGuard } from "./UnsavedGuard";
import { UploadPanel } from "./UploadPanel";
import { SectionLabel } from "./ui";

type SaveJSON = { doc?: Record<string, unknown>; result?: Record<string, unknown>; message?: string };

export function EditView({ shell, drafts }: { shell: ShellData; drafts: boolean }) {
  const info = useDocumentInfo();
  const { id, action, collectionSlug, globalSlug, docPermissions, getDocPreferences, getDocPermissions, hasSavePermission, initialState, isInitializing, incrementVersionCount, setData, data } = info;
  const { getEntityConfig, config } = useConfig();
  const entity = getEntityConfig(collectionSlug ? { collectionSlug } : { globalSlug: globalSlug! });
  const { getFormState } = useServerFunctions();
  const { reportUpdate } = useDocumentEvents();
  const { startRouteTransition } = useRouteTransition();
  const router = useRouter();
  const { item, list } = useRise();
  const abortChange = useRef<AbortController | null>(null);

  const operation = collectionSlug && !id ? "create" : "update";
  const schemaPath = entity?.slug ?? shell.slug;
  const isAuth = Boolean(entity && "auth" in entity && entity.auth);
  const isUpload = Boolean(entity && "upload" in entity && entity.upload);
  const readOnly = !hasSavePermission;

  const { main, side } = useMemo(() => {
    const fields = (entity?.fields ?? []) as ClientField[];
    // Puste miejsca (null) zachowują indeksy pól, jak w DocumentFields Payloada.
    return {
      main: fields.map((f) => (fieldIsSidebar(f) ? null : f)) as ClientField[],
      side: fields.map((f) => (fieldIsSidebar(f) ? f : null)) as ClientField[],
    };
  }, [entity]);
  const hasSide = side.some(Boolean);

  const onChange = useCallback(
    async ({ formState, submitted }: { formState: FormState; submitted?: boolean }) => {
      abortChange.current?.abort();
      const controller = new AbortController();
      abortChange.current = controller;
      const docPreferences = await getDocPreferences();
      const result = await getFormState({
        id,
        collectionSlug,
        globalSlug,
        docPermissions,
        docPreferences,
        formState,
        operation,
        schemaPath,
        signal: controller.signal,
        skipValidation: !submitted,
        renderAllFields: false,
        returnLockStatus: false,
        updateLastEdited: false,
      }).catch(() => null);
      return result?.state ?? formState;
    },
    [collectionSlug, docPermissions, getDocPreferences, getFormState, globalSlug, id, operation, schemaPath],
  );

  const onSuccess = useCallback(
    async (json: SaveJSON, ctx?: { formState?: FormState }) => {
      const doc = json?.doc ?? json?.result;
      incrementVersionCount();
      setData?.((doc ?? {}) as never);
      reportUpdate({ id: doc?.id as string, doc: doc as never, entitySlug: schemaPath, operation, updatedAt: String(doc?.updatedAt ?? new Date().toISOString()) });
      if (operation === "create" && collectionSlug && doc?.id) {
        startRouteTransition(() => router.push(`${config.routes.admin}/collections/${collectionSlug}/${doc.id}`));
        return;
      }
      await getDocPermissions(json as never);
      const docPreferences = await getDocPreferences();
      const res = await getFormState({
        id,
        collectionSlug,
        globalSlug,
        data: doc,
        docPermissions,
        docPreferences,
        formState: ctx?.formState,
        operation,
        schemaPath,
        renderAllFields: false,
        returnLockStatus: false,
        skipValidation: true,
      }).catch(() => null);
      if (res?.state && isUpload) delete res.state.file;
      // Nagłówek, licznik wersji i meta są renderowane na serwerze.
      router.refresh();
      return res?.state;
    },
    [collectionSlug, config.routes.admin, docPermissions, getDocPermissions, getDocPreferences, getFormState, globalSlug, id, incrementVersionCount, isUpload, operation, reportUpdate, router, schemaPath, setData, startRouteTransition],
  );

  return (
    <OperationProvider operation={operation}>
      <Form
        action={action}
        method={id ? "PATCH" : "POST"}
        initialState={!isInitializing ? initialState : undefined}
        isInitializing={isInitializing}
        isDocumentForm
        disabled={readOnly || isInitializing}
        disableValidationOnSubmit={!(operation === "create" && isAuth)}
        disableSuccessStatus={operation === "create"}
        onChange={[onChange]}
        onSuccess={onSuccess as never}
        className="hn-edit"
      >
        <UnsavedGuard />
        <motion.div
          variants={list}
          initial="hidden"
          animate="show"
          className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <motion.section variants={item} className="flex min-w-0 flex-col gap-8" aria-label="Pola dokumentu" data-testid="document-main">
            {isUpload && <UploadPanel isCreate={operation === "create"} data={data} />}
            {isAuth && <AuthPanel isCreate={operation === "create"} readOnly={readOnly} />}
            <RenderFields
              className="hn-fields flex flex-col gap-6"
              fields={main}
              forceRender
              parentIndexPath=""
              parentPath=""
              parentSchemaPath={schemaPath}
              permissions={docPermissions?.fields ?? {}}
              readOnly={readOnly}
            />
          </motion.section>

          <motion.aside variants={item} className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-6 lg:self-start" aria-label="Szczegóły" data-testid="document-sidebar">
            {(shell.meta.createdAt || shell.id) && (
              <dl className="grid grid-cols-2 border-t border-ink">
                {[
                  ["Utworzono", shell.meta.createdAt],
                  ["Zmieniono", shell.meta.updatedAt],
                  ["Opublikował(a)", shell.meta.author],
                  ["ID", shell.id],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value], i) => (
                    <div key={label} className={`py-4 ${i % 2 ? "pl-4" : "pr-4"} ${i > 1 ? "border-t border-border" : ""}`}>
                      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
                      <dd className="mt-1 font-mono text-[13px] text-ink tabular-nums">{value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {hasSide && (
              <div className="flex flex-col gap-5">
                <SectionLabel>Ustawienia dokumentu</SectionLabel>
                <RenderFields
                  className="hn-fields flex flex-col gap-5"
                  fields={side}
                  forceRender
                  parentIndexPath=""
                  parentPath=""
                  parentSchemaPath={schemaPath}
                  permissions={docPermissions?.fields ?? {}}
                  readOnly={readOnly}
                />
              </div>
            )}
          </motion.aside>
        </motion.div>
        <DocumentControls shell={shell} drafts={drafts} operation={operation} />
      </Form>
    </OperationProvider>
  );
}
