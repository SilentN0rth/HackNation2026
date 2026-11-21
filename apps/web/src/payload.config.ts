/**
 * Konfiguracja Payload CMS (panel urzędnika pod /official, REST pod /api/payload).
 * Etap 0 – agenci NIE edytują tego pliku. Widoki panelu zmienia się we fragmentach
 * src/payload/admin/config/{collections,fields,views}.ts (kontrakt: admin/config/types.ts), a shell, logowanie,
 * konto i motyw dokłada plugin src/payload/plugins/admin-ui.
 */
import { existsSync, readFileSync } from "node:fs";
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
import { fragment as viewsFragment } from "./payload/admin/config/views";
import { collections } from "./payload/collections";
import { prefillEndpoint } from "./payload/endpoints/prefill";
import { Registry } from "./payload/globals/Registry";
import { migrations } from "./migrations";
import { Settings } from "./payload/globals/Settings";
import { seed } from "./payload/seed/seed";
import { adminUiPlugin } from "./payload/plugins/admin-ui";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function payloadSecret(): string {
  if (process.env.PAYLOAD_SECRET) return process.env.PAYLOAD_SECRET;
  // Docker secrets: plik montowany w /run/secrets (docker-compose.yml, scripts/make-secrets.sh).
  const file = process.env.PAYLOAD_SECRET_FILE;
  if (file && existsSync(file)) return readFileSync(file, "utf8").trim();
  // Fallback tylko lokalnie i na czas `next build` (bez połączenia z bazą); produkcja wymaga sekretu.
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") {
    return "dev-only-payload-secret-change-me";
  }
  throw new Error("Brak PAYLOAD_SECRET – ustaw go w środowisku produkcyjnym.");
}

const panel = mergeFragments([collectionsFragment, fieldsFragment, viewsFragment]);

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
    // Lokalnie schemat synchronizuje „push”; produkcja (NODE_ENV=production) uruchamia migracje przy starcie.
    // Po zmianie kolekcji: `npm run payload migrate:create <nazwa>`.
    prodMigrations: migrations,
  }),
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  i18n: { supportedLanguages: { pl }, fallbackLanguage: "pl" },
  sharp,
  telemetry: false,
  plugins: [adminUiPlugin()],
  // Kontener demo (PAYLOAD_SEED=true) zakłada konto i dane demonstracyjne przy starcie; seed jest idempotentny.
  async onInit(payload) {
    if (process.env.PAYLOAD_SEED === "true") await seed(payload);
  },
});
