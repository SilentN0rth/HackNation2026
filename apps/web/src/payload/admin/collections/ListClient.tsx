"use client";

import {
  Button,
  Checkbox,
  Dropdown,
  Label,
  Link,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Table,
  ToggleButton,
  ToggleButtonGroup,
  type Selection,
  type SortDescriptor,
} from "@heroui/react";
import { toast, useListQuery, useRouteTransition, useStepNav } from "@payloadcms/ui";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Cell, Thumb } from "./Cells";
import { PER_PAGE, type ListMode } from "./config";
import { ConfirmDialog } from "./ConfirmDialog";
import { useRise, useSlideUp } from "./motion";
import type { ListRow, ListViewData } from "./types";
import { ArrowRight, EmptyBlock, Icon, PageHeader, StatusChip, ViewRoot } from "./ui";

type Where = Record<string, unknown>;

function filtersFromWhere(where: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (w: unknown) => {
    if (!w || typeof w !== "object") return;
    const obj = w as Where;
    for (const [key, val] of Object.entries(obj)) {
      if (key === "and" || key === "or") (val as unknown[]).forEach(visit);
      else if (val && typeof val === "object" && "equals" in (val as Where)) out[key] = String((val as Where).equals);
    }
  };
  visit(where);
  return out;
}

const whereFromFilters = (filters: Record<string, string>): Where => {
  const parts = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ [k]: { equals: v } }));
  return parts.length ? { and: parts } : {};
};

function idsQuery(ids: (string | number)[]) {
  return ids.map((id, i) => `where[id][in][${i}]=${encodeURIComponent(String(id))}`).join("&");
}

export function ListClient({ data }: { data: ListViewData }) {
  const router = useRouter();
  const { query, handleSearchChange, handleSortChange, handlePageChange, handlePerPageChange, handleWhereChange, refineListData } = useListQuery();
  const { isTransitioning } = useRouteTransition();
  const { item, list, layout, reduce } = useRise();
  const slide = useSlideUp();
  const cfg = data.config;
  const modes: ListMode[] = cfg.modes ?? ["table"];

  const modeKey = `hn-list-mode:${data.slug}`;
  const saved = useSyncExternalStore(subscribeMode, () => readMode(modeKey), () => null);
  const mode: ListMode = saved && modes.includes(saved as ListMode) ? (saved as ListMode) : modes[0]!;
  const changeMode = (m: ListMode) => writeMode(modeKey, m);

  const [search, setSearch] = useState(typeof query.search === "string" ? query.search : "");
  const currentSearch = typeof query.search === "string" ? query.search : "";
  useEffect(() => {
    if (search === currentSearch) return;
    const t = setTimeout(() => void handleSearchChange?.(search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handler zmienia się przy każdej zmianie query
  }, [search]);

  const filters = filtersFromWhere(query.where);
  const setFilter = (name: string, value: string) => void handleWhereChange?.(whereFromFilters({ ...filters, [name]: value }) as never);

  const visible = data.columns.filter((c) => c.active);
  const toggleColumns = (keys: Selection) => {
    const active = keys === "all" ? new Set(data.columns.map((c) => c.name)) : new Set([...keys].map(String));
    if (active.size === 0) return;
    void refineListData({ columns: data.columns.map((c) => (active.has(c.name) ? c.name : `-${c.name}`)) });
  };

  const sort = typeof query.sort === "string" ? query.sort : "";
  const sortDescriptor: SortDescriptor | undefined = sort
    ? { column: sort.replace(/^-/, ""), direction: sort.startsWith("-") ? "descending" : "ascending" }
    : undefined;

  const [picked, setSelected] = useState<Set<string | number>>(new Set());
  const [removing, setRemoving] = useState<Set<string | number>>(new Set());
  const rowIds = useMemo(() => data.rows.map((r) => r.id), [data.rows]);
  const selected = useMemo(() => new Set([...picked].filter((id) => rowIds.includes(id))), [picked, rowIds]);
  const selectable = data.canDelete || Boolean(cfg.bulkPublish);

  const [confirm, setConfirm] = useState<null | "delete" | "publish">(null);
  const [busy, setBusy] = useState(false);

  async function bulk(kind: "delete" | "publish") {
    const ids = [...selected];
    setBusy(true);
    try {
      const res = await fetch(`${data.apiRoute}/${data.slug}?${idsQuery(ids)}`, {
        method: kind === "delete" ? "DELETE" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept-Language": "pl" },
        body: kind === "publish" ? JSON.stringify({ status: "published", _status: "published" }) : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as { docs?: unknown[]; errors?: { message: string }[]; message?: string };
      const done = json.docs?.length ?? 0;
      const failed = json.errors ?? [];
      if (done > 0) {
        toast.success(kind === "delete" ? `Usunięto: ${done}` : `Opublikowano: ${done}`);
        if (kind === "delete") setRemoving(new Set(ids));
      }
      if (failed.length || !res.ok) toast.error(failed[0]?.message ?? json.message ?? "Operacja nie powiodła się.");
      setConfirm(null);
      setSelected(new Set());
      setTimeout(() => {
        router.refresh();
        setRemoving(new Set());
      }, reduce ? 0 : 260);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const crumbs = [{ label: "Panel", href: data.adminRoute }, { label: data.plural }];
  const { setStepNav } = useStepNav();
  useEffect(() => {
    setStepNav([{ label: data.plural }]);
  }, [data.plural, setStepNav]);
  const hasQuery = Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <ViewRoot testId={`list-${data.slug}`}>
      <PageHeader
        crumbs={crumbs}
        title={data.plural}
        description={cfg.description}
        actions={
          data.canCreate && (
            <Button variant="primary" size="lg" onPress={() => router.push(data.newHref)} data-testid="list-create">
              {Icon.plus}
              Utwórz
            </Button>
          )
        }
      />

      {/* Pasek narzędzi */}
      <div className="mb-6 flex flex-wrap items-end gap-3 border-t border-ink pt-5">
        <SearchField value={search} onChange={setSearch} aria-label="Szukaj" className="w-full sm:w-72">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={`Szukaj: ${data.plural.toLowerCase()}`} data-testid="list-search" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {data.filters.map((f) => (
          <Select
            key={f.name}
            aria-label={f.label}
            value={filters[f.name] ?? "__all"}
            onChange={(k) => setFilter(f.name, k && k !== "__all" ? String(k) : "")}
            className="w-[calc(50%-0.375rem)] sm:w-48"
            data-testid={`filter-${f.name}`}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="__all" textValue={`${f.label}: wszystkie`}>
                  {f.label}: wszystkie
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {f.options.map((o) => (
                  <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                    {o.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {mode === "table" && (
            <Dropdown>
              <Button variant="secondary" aria-label="Kolumny" data-testid="list-columns">
                {Icon.columns}
                <span className="hidden sm:inline">Kolumny</span>
              </Button>
              <Dropdown.Popover className="min-w-56">
                <Dropdown.Menu
                  aria-label="Widoczne kolumny"
                  selectionMode="multiple"
                  selectedKeys={new Set(visible.map((c) => c.name))}
                  onSelectionChange={toggleColumns}
                >
                  {data.columns.map((c) => (
                    <Dropdown.Item key={c.name} id={c.name} textValue={c.label}>
                      <Label>{c.label}</Label>
                      <Dropdown.ItemIndicator />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          {modes.length > 1 && (
            <ToggleButtonGroup
              aria-label="Układ listy"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([mode])}
              onSelectionChange={(k) => changeMode([...k][0] as ListMode)}
            >
              {modes.map((m) => (
                <ToggleButton key={m} id={m} isIconOnly aria-label={MODE_LABEL[m]} data-testid={`mode-${m}`}>
                  {m === "grid" ? Icon.grid : m === "timeline" ? Icon.timeline : Icon.list}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </div>
      </div>

      <p className="mb-3 flex items-center gap-3 text-sm text-muted" aria-live="polite">
        <span data-testid="list-count">
          {data.totalDocs} {plural(data.totalDocs)}
        </span>
        {isTransitioning && (
          <span className="inline-flex items-center gap-2" role="status">
            <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-accent" />
            Wczytywanie…
          </span>
        )}
      </p>

      <div className={`transition-opacity duration-200 ${isTransitioning ? "opacity-60" : ""}`}>
        {data.rows.length === 0 ? (
          <EmptyBlock
            title={hasQuery ? "Brak wyników" : `Brak: ${data.plural.toLowerCase()}`}
            text={hasQuery ? "Zmień wyszukiwaną frazę albo wyczyść filtry." : cfg.readOnly ? "Wpisy pojawią się, gdy w systemie zajdą zmiany." : "Utwórz pierwszy dokument, a pojawi się tutaj."}
            action={
              hasQuery ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setSearch("");
                    void handleWhereChange?.({});
                  }}
                >
                  Wyczyść filtry
                </Button>
              ) : (
                data.canCreate && (
                  <Button variant="primary" onPress={() => router.push(data.newHref)}>
                    Utwórz
                  </Button>
                )
              )
            }
          />
        ) : mode === "timeline" ? (
          <Timeline rows={data.rows} />
        ) : mode === "grid" ? (
          <motion.ul variants={list} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="media-grid">
            {data.rows.map((r) => (
              <motion.li key={r.id} variants={item} layout transition={layout} animate={removing.has(r.id) ? { opacity: 0, scale: 0.96 } : "show"}>
                <GridTile row={r} selectable={selectable} selected={selected.has(r.id)} onToggle={(v) => setSelected((s) => toggle(s, r.id, v))} />
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <Table variant="secondary" className="overflow-x-auto">
            <Table.ScrollContainer>
              <Table.Content
                aria-label={data.plural}
                sortDescriptor={sortDescriptor}
                onSortChange={(d) => void handleSortChange?.(`${d.direction === "descending" ? "-" : ""}${d.column}`)}
                onRowAction={(key) => router.push(`${data.adminRoute}/collections/${data.slug}/${key}`)}
                className="min-w-full"
              >
                <Table.Header>
                  {[
                    ...(selectable
                      ? [
                          <Table.Column key="__sel" className="w-10 pr-0">
                            <Checkbox
                              slot={null}
                              aria-label="Zaznacz wszystkie"
                              isSelected={selected.size > 0 && selected.size === rowIds.length}
                              isIndeterminate={selected.size > 0 && selected.size < rowIds.length}
                              onChange={(on) => setSelected(new Set(on ? rowIds : []))}
                              data-testid="select-all"
                            >
                              <Checkbox.Content><Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control></Checkbox.Content>
                            </Checkbox>
                          </Table.Column>,
                        ]
                      : []),
                    ...visible.map((c, i) => (
                      <Table.Column key={c.name} id={c.name} allowsSorting={c.sortable} isRowHeader={i === 0}>
                        {({ sortDirection }) => (
                          <Table.SortableColumnHeader sortDirection={sortDirection}>{c.label}</Table.SortableColumnHeader>
                        )}
                      </Table.Column>
                    )),
                    <Table.Column key="__go" className="w-10">
                      <span className="sr-only">Otwórz</span>
                    </Table.Column>,
                  ]}
                </Table.Header>
                <Table.Body>
                  {data.rows.map((r, ri) => (
                    <Table.Row
                      key={r.id}
                      id={String(r.id)}
                      className="row-link cursor-pointer"
                      data-testid="list-row"
                      render={(props) => (
                        <motion.tr
                          {...(props as ComponentProps<typeof motion.tr>)}
                          layout
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
                          animate={removing.has(r.id) ? { opacity: 0, x: -12 } : { opacity: 1, y: 0, x: 0, filter: "blur(0px)" }}
                          transition={{ ...layout, delay: removing.has(r.id) ? 0 : reduce ? 0 : Math.min(ri, 12) * 0.06 }}
                        />
                      )}
                    >
                      {[
                        ...(selectable
                          ? [
                              <Table.Cell key="__sel" className="pr-0">
                                {/* Zatrzymujemy zdarzenia, żeby kliknięcie pola nie otwierało dokumentu (akcja wiersza). */}
                                <span className="inline-flex" onPointerDown={stop} onPointerUp={stop} onMouseDown={stop} onClick={stop} onKeyDown={stop}>
                                  <Checkbox
                                    slot={null}
                                    aria-label={`Zaznacz: ${r.title}`}
                                    isSelected={selected.has(r.id)}
                                    onChange={(on) => setSelected((s) => toggle(s, r.id, on))}
                                    data-testid="row-select"
                                  >
                                    <Checkbox.Content><Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control></Checkbox.Content>
                                  </Checkbox>
                                </span>
                              </Table.Cell>,
                            ]
                          : []),
                        ...visible.map((c, i) => (
                          <Table.Cell key={c.name}>
                            {i === 0 ? (
                              <span className="flex min-w-0 items-center gap-3">
                                {r.file && <Thumb src={r.file.thumb} ext={r.file.ext} />}
                                <span className="row-title block max-w-[40ch] truncate font-semibold text-ink">
                                  {c.kind === "status" || c.kind === "date" || c.kind === "id" ? <Cell col={c} value={r.cells[c.name] ?? null} /> : (r.cells[c.name]?.text || r.title)}
                                </span>
                              </span>
                            ) : (
                              <Cell col={c} value={r.cells[c.name] ?? null} />
                            )}
                          </Table.Cell>
                        )),
                        <Table.Cell key="__go" className="text-right">
                          <ArrowRight className="row-arrow ml-auto size-4 text-accent" />
                        </Table.Cell>,
                      ]}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </div>

      {/* Paginacja + liczba na stronie */}
      {data.totalDocs > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Pagination className="w-auto" data-testid="list-pagination">
            <Pagination.Summary className="text-sm text-muted">
              Strona {data.page} z {Math.max(1, data.totalPages)}
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={data.page <= 1} onPress={() => void handlePageChange?.(data.page - 1)} aria-label="Poprzednia strona">
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pages(data.page, data.totalPages).map((p, i) =>
                p === "…" ? (
                  <Pagination.Item key={`e${i}`}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={p}>
                    <Pagination.Link isActive={p === data.page} onPress={() => void handlePageChange?.(p)} aria-label={`Strona ${p}`}>
                      {p}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}
              <Pagination.Item>
                <Pagination.Next isDisabled={data.page >= data.totalPages} onPress={() => void handlePageChange?.(data.page + 1)} aria-label="Następna strona">
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
          <Select
            aria-label="Na stronie"
            value={String(data.limit)}
            onChange={(k) => k && void handlePerPageChange?.(Number(k))}
            className="flex w-44 flex-row items-center gap-3"
            data-testid="list-per-page"
          >
            <Label className="text-sm whitespace-nowrap text-muted">Na stronie</Label>
            <Select.Trigger className="w-20">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {[...new Set([...PER_PAGE, data.limit])].sort((a, b) => a - b).map((n) => (
                  <ListBox.Item key={n} id={String(n)} textValue={String(n)}>
                    {n}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      )}

      {/* Akcje masowe */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            {...slide}
            className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xl flex-wrap items-center gap-3 rounded-[10px] border border-ink bg-white px-4 py-3"
            role="toolbar"
            aria-label="Akcje dla zaznaczonych"
            data-testid="bulk-bar"
          >
            <span className="mr-auto text-sm font-semibold text-ink">
              Zaznaczono: <span className="font-mono tabular-nums">{selected.size}</span>
            </span>
            <Button variant="ghost" size="sm" onPress={() => setSelected(new Set())}>
              Odznacz
            </Button>
            {cfg.bulkPublish && (
              <Button variant="secondary" size="sm" onPress={() => setConfirm("publish")} data-testid="bulk-publish">
                Opublikuj
              </Button>
            )}
            {data.canDelete && (
              <Button variant="danger" size="sm" onPress={() => setConfirm("delete")} data-testid="bulk-delete">
                Usuń
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Opublikować zaznaczone?" : "Usunąć zaznaczone?"}
        confirmLabel={confirm === "publish" ? "Opublikuj" : "Usuń"}
        tone={confirm === "publish" ? "accent" : "danger"}
        busy={busy}
        onConfirm={() => confirm && void bulk(confirm)}
      >
        {confirm === "publish"
          ? `Formularze (${selected.size}) staną się dostępne dla obywateli. Publikacja wymaga obsłużenia uwag krytycznych.`
          : `Dokumenty (${selected.size}) zostaną trwale usunięte. Tej operacji nie można cofnąć.`}
      </ConfirmDialog>
    </ViewRoot>
  );
}

const modeListeners = new Set<() => void>();
const subscribeMode = (cb: () => void) => {
  modeListeners.add(cb);
  return () => modeListeners.delete(cb);
};
const readMode = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeMode = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
  modeListeners.forEach((cb) => cb());
};

const MODE_LABEL: Record<ListMode, string> = { table: "Tabela", grid: "Siatka", timeline: "Oś czasu" };

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const toggle = (s: Set<string | number>, id: string | number, on: boolean) => {
  const n = new Set(s);
  if (on) n.add(id);
  else n.delete(id);
  return n;
};

function plural(n: number) {
  if (n === 1) return "dokument";
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? "dokumenty" : "dokumentów";
}

function pages(page: number, total: number): (number | "…")[] {
  const t = Math.max(1, total);
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(t - 1, page + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < t - 1) out.push("…");
  out.push(t);
  return out;
}

function Timeline({ rows }: { rows: ListRow[] }) {
  const { item, list } = useRise();
  return (
    <motion.ol variants={list} initial="hidden" animate="show" className="relative border-t border-ink" data-testid="audit-timeline">
      {rows.map((r) => (
        <motion.li key={r.id} variants={item} className="relative grid grid-cols-[2.5rem_1fr] gap-4 border-b border-border py-5 sm:grid-cols-[10rem_2.5rem_1fr]">
          <time className="hidden pt-2 font-mono text-[13px] text-muted tabular-nums sm:block">{r.timeline?.date}</time>
          <span className="relative flex justify-center">
            <span aria-hidden className="absolute top-0 -bottom-5 w-px bg-border" />
            <span className="relative grid size-9 place-items-center rounded-full border border-border bg-white text-xs font-semibold text-ink">
              {r.timeline?.initials}
            </span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold text-ink">{r.timeline?.actor}</span>
              {r.status && <StatusChip label={r.status.label} tone={r.status.tone} />}
              <time className="font-mono text-xs text-muted sm:hidden">{r.timeline?.date}</time>
            </div>
            <p className="mt-1.5 leading-relaxed text-ink-2">{r.timeline?.details}</p>
            {r.timeline?.link && (
              <Link href={r.timeline.link.href} className="link-arrow mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                {r.timeline.link.label}
                <ArrowRight />
              </Link>
            )}
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function GridTile({ row, selectable, selected, onToggle }: { row: ListRow; selectable: boolean; selected: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div
      className={`row-link group relative flex h-full flex-col rounded-[10px] border p-3 transition-colors duration-150 ${selected ? "border-accent bg-accent-soft" : "border-border hover:border-ink"}`}
      data-testid="media-tile"
    >
      {selectable && (
        <Checkbox isSelected={selected} onChange={onToggle} aria-label={`Zaznacz: ${row.title}`} className="absolute top-5 left-5 z-10">
          <Checkbox.Content><Checkbox.Control className="bg-white">
            <Checkbox.Indicator />
          </Checkbox.Control></Checkbox.Content>
        </Checkbox>
      )}
      <Link href={row.href} className="flex flex-1 flex-col gap-3 no-underline">
        <Thumb src={row.file?.thumb} ext={row.file?.ext} size="lg" />
        <span className="min-w-0">
          <span className="row-title block truncate text-sm font-semibold text-ink">{row.title}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="font-mono">{row.file?.ext}</span>
            <span aria-hidden>·</span>
            <span className="font-mono tabular-nums">{row.file?.size}</span>
          </span>
        </span>
      </Link>
    </div>
  );
}
