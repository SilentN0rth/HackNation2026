import { execSync } from "node:child_process";

/** Baza testowa = lokalna baza Payloada z danymi demo (seed jest idempotentny). */
export default function globalSetup() {
  execSync("npm run payload:seed", { stdio: "inherit", env: { ...process.env } });
}
