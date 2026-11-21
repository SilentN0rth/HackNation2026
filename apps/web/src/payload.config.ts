/**
 * Konfiguracja Payload CMS (panel urzędnika pod /official, REST pod /api/payload).
 * Etap 0 – agenci NIE edytują tego pliku. Wygląd i widoki panelu zmienia się we fragmentach
 * src/payload/admin/config/{theme,shell,collections,fields,views}.ts (kontrakt: admin/config/types.ts).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { pl } from "@payloadcms/translations/languages/pl";
import { buildConfig } from "payload";
import sharp from "sharp";
import { fragment as collectionsFragment } from "./payload/admin/config/collections";
import { fragment as fieldsFragment } from "./payload/admin/config/fields";
import { applyToCollections, applyToGlobals, mergeFragments } from "./payload/admin/config/merge";
import { fragment as shellFragment } from "./payload/admin/config/shell";
import { fragment as themeFragment } from "./payload/admin/config/theme";
import { fragment as viewsFragment } from "./payload/admin/config/views";
import { collections } from "./payload/collections";
import { prefillEndpoint } from "./payload/endpoints/prefill";
import { Registry } from "./payload/globals/Registry";
import { Settings } from "./payload/globals/Settings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function payloadSecret(): string {
  if (process.env.PAYLOAD_SECRET) return process.env.PAYLOAD_SECRET;
  // Fallback tylko lokalnie i na czas `next build` (bez połączenia z bazą); produkcja wymaga sekretu.
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") {
    return "dev-only-payload-secret-change-me";
  }
  throw new Error("Brak PAYLOAD_SECRET – ustaw go w środowisku produkcyjnym.");
}

const panel = mergeFragments([themeFragment, shellFragment, collectionsFragment, fieldsFragment, viewsFragment]);

export default buildConfig({
  secret: payloadSecret(),
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || undefined,
  routes: { admin: "/official", api: "/api/payload" },
  admin: {
    ...panel.admin,
    user: "users",
    meta: { titleSuffix: " · e-Formularze", ...panel.admin?.meta },
    importMap: { baseDir: dirname },
    components: panel.components,
  },
  collections: applyToCollections(collections, panel),
  globals: applyToGlobals([Settings, Registry], panel),
  endpoints: [prefillEndpoint],
  editor: lexicalEditor(),
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URL || `file:${path.resolve(dirname, "../data/payload.db")}` },
  }),
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  i18n: { supportedLanguages: { pl }, fallbackLanguage: "pl" },
  sharp,
  telemetry: false,
});
